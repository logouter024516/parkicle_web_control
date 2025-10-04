
import './App.css';
import React, { useEffect, useState, useCallback } from 'react';
import { auth, provider, signInWithPopup, onAuthStateChanged, db } from './firebase';
import { collection, getDocs } from 'firebase/firestore';

// 쿠키 관리 함수들
const setCookie = (name, value, days = 30) => {
  const expires = new Date();
  expires.setTime(expires.getTime() + days * 24 * 60 * 60 * 1000);
  document.cookie = `${name}=${value};expires=${expires.toUTCString()};path=/`;
};

const getCookie = (name) => {
  const nameEQ = name + "=";
  const ca = document.cookie.split(';');
  for (let i = 0; i < ca.length; i++) {
    let c = ca[i];
    while (c.charAt(0) === ' ') c = c.substring(1, c.length);
    if (c.indexOf(nameEQ) === 0) return c.substring(nameEQ.length, c.length);
  }
  return null;
};



function maskCarNum(carNum) {
  if (!carNum) return '';
  return carNum.slice(-4);
}

function App() {
  const [areaCode, setAreaCode] = useState('');
  const [stations, setStations] = useState([]);
  const [page, setPage] = useState(-1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [user, setUser] = useState(null);
  const [showLogin, setShowLogin] = useState(true);
  const [authLoading, setAuthLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [showMenu, setShowMenu] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authAction, setAuthAction] = useState(null);
  const [authInput, setAuthInput] = useState('');

  // 관리자 인증번호 (실제 운영시에는 환경변수나 서버에서 관리)
  const ADMIN_CODE = '1234';

  // 인증 요구 함수
  const requireAuth = (action, actionName) => {
    setAuthAction({ action, actionName });
    setShowAuthModal(true);
    setAuthInput('');
    setShowMenu(false);
  };

  // 인증 확인
  const handleAuthConfirm = () => {
    if (authInput === ADMIN_CODE) {
      setShowAuthModal(false);
      authAction.action();
      setAuthAction(null);
      setAuthInput('');
    } else {
      alert('인증번호가 올바르지 않습니다.');
      setAuthInput('');
    }
  };

  // 인증 취소
  const handleAuthCancel = () => {
    setShowAuthModal(false);
    setAuthAction(null);
    setAuthInput('');
  };

  // 컴포넌트 마운트 시 쿠키에서 areaCode 불러오기
  useEffect(() => {
    const savedAreaCode = getCookie('areaCode');
    if (savedAreaCode) {
      setAreaCode(savedAreaCode);
      console.log('쿠키에서 areaCode 불러옴:', savedAreaCode);
    }
  }, []);

  // 인증 상태 변화 감지
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      console.log('Auth state changed:', currentUser);
      setUser(currentUser);
      setShowLogin(!currentUser);
      setAuthLoading(false);
      
      if (currentUser) {
        console.log('User logged in:', currentUser.email);
        console.log('Auth token available:', !!currentUser.accessToken);
      }
    });

    return () => unsubscribe();
  }, []);

  // Google 로그인
  const handleLogin = async () => {
    setLoading(true);
    setError('');
    try {
      console.log('Attempting Google login...');
      const result = await signInWithPopup(auth, provider);
      console.log('Login successful:', result.user.email);
      
      // 로그인 성공 후 토큰 확인
      const token = await result.user.getIdToken();
      console.log('ID Token obtained:', !!token);
      
      setUser(result.user);
      setShowLogin(false);
    } catch (e) {
      console.error('Login error:', e);
      setError('로그인 실패: ' + e.message);
    } finally {
      setLoading(false);
    }
  };

  // areaCode 입력 시 Firestore에서 충전소 정보 불러오기
  const fetchStations = useCallback(async () => {
    if (!areaCode || !user) return;
    
    setLoading(true);
    setError('');
    try {
      console.log('Fetching data for areaCode:', areaCode);
      console.log('Current user:', user.email);
      
      // 인증 토큰 재확인
      const token = await user.getIdToken(true); // force refresh
      console.log('Fresh token obtained:', !!token);
      
      const colRef = collection(db, areaCode);
      console.log('Collection reference created for:', areaCode);
      
      const snapshot = await getDocs(colRef);
      console.log('Firestore query executed, docs found:', snapshot.size);
      
      const data = snapshot.docs.map(doc => ({ 
        id: doc.id, 
        ...doc.data() 
      }));
      
      console.log('Data retrieved:', data);
      setStations(data);
      setLastUpdated(new Date());
      
      if (data.length === 0) {
        console.log(`컬렉션 '${areaCode}'에 데이터가 없음 - 기본 프레임 생성`);
        // 기본 8개 빈 충전소 생성 (완전히 빈 상태)
        const defaultStations = Array.from({ length: 8 }, (_, i) => ({
          id: `CS-${String(i + 1).padStart(2, '0')}`,
          carNum: null,
          chargingTime: 0,
          isIllegal: false
        }));
        setStations(defaultStations);
      }
    } catch (e) {
      console.error('Firestore error:', e);
      console.error('Error code:', e.code);
      console.error('Error message:', e.message);
      
      if (e.code === 'permission-denied') {
        console.log('권한 오류 - 기본 프레임 생성');
        // 기본 8개 빈 충전소 생성 (완전히 빈 상태)
        const defaultStations = Array.from({ length: 8 }, (_, i) => ({
          id: `CS-${String(i + 1).padStart(2, '0')}`,
          carNum: null,
          chargingTime: 0,
          isIllegal: false
        }));
        setStations(defaultStations);
        setError(`컬렉션 '${areaCode}' 접근 권한이 없습니다. 기본 프레임을 표시합니다.`);
      } else {
        // 다른 오류의 경우에도 기본 프레임 생성
        console.log('기타 오류 - 기본 프레임 생성');
        const defaultStations = Array.from({ length: 8 }, (_, i) => ({
          id: `CS-${String(i + 1).padStart(2, '0')}`,
          carNum: null,
          chargingTime: 0,
          isIllegal: false
        }));
        setStations(defaultStations);
        setError(`데이터 로드 실패: ${e.message}. 기본 프레임을 표시합니다.`);
      }
    }
    setLoading(false);
  }, [areaCode, user]);

  useEffect(() => {
    fetchStations();
  }, [fetchStations]);

  // 1분 간격 자동 새로고침
  useEffect(() => {
    if (!autoRefresh || !areaCode || !user) return;

    const interval = setInterval(() => {
      console.log('자동 새로고침 실행...');
      fetchStations();
    }, 60000); // 1분 = 60000ms

    return () => clearInterval(interval);
  }, [autoRefresh, areaCode, user, fetchStations]);

  // 메뉴 외부 클릭 시 닫기
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (showMenu && !event.target.closest('.hamburger-menu')) {
        setShowMenu(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showMenu]);

  // 충전소 상태 결정 함수
  const getStationStatus = (station) => {
    if (station.isIllegal) return 'illegal';
    if (station.carNum && station.chargingTime > 0) return 'charging';
    return 'available';
  };

  // 충전소 클릭 핸들러
  const handleStationClick = (index) => {
    setPage(index);
  };

  // 요약 페이지로 돌아가기
  const handleBackToSummary = () => {
    setPage(-1);
  };

  // 키보드 네비게이션 (기존 기능 유지)
  const handleKeyDown = useCallback((e) => {
    if (stations.length === 0) return;
    if (e.key === 'Enter') {
      setPage(-1);
    } else if (e.key === 'ArrowRight') {
      setPage(p => Math.min(p + 1, stations.length - 1));
    } else if (e.key === 'ArrowLeft') {
      setPage(p => Math.max(p - 1, -1));
    }
  }, [stations.length]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  // 렌더링
  if (authLoading) {
    return <div>인증 상태 확인 중...</div>;
  }

  if (showLogin) {
    return (
      <div className="App">
        <h2>Google로 로그인하세요</h2>
        <button 
          onClick={handleLogin} 
          disabled={loading}
          style={{padding: '1em', fontSize: '1em'}}
        >
          {loading ? '로그인 중...' : 'Google 로그인'}
        </button>
        {error && <div style={{color: 'red', marginTop: '1em'}}>{error}</div>}
        {user && <div style={{color: 'green', marginTop: '1em'}}>로그인됨: {user.email}</div>}
      </div>
    );
  }

  // areaCode가 없으면 입력 버튼을 보여줌
  if (!areaCode) {
    const handleAreaCodeInput = () => {
      const code = window.prompt('Charging Station Area code:');
      if (code) {
        setAreaCode(code);
        setCookie('areaCode', code); // 쿠키에 저장
        console.log('areaCode 쿠키에 저장됨:', code);
      }
    };
    return (
      <div className="App">
        <h2>Area code를 입력하세요.</h2>
        <button onClick={handleAreaCodeInput} style={{padding: '1em', fontSize: '1em'}}>Area code 입력</button>
        {getCookie('areaCode') && (
          <div style={{marginTop: '1em', color: '#666'}}>
            이전 설정: {getCookie('areaCode')} 
            <button onClick={() => {setAreaCode(getCookie('areaCode'))}} style={{marginLeft: '10px', padding: '0.5em'}}>
              사용하기
            </button>
          </div>
        )}
      </div>
    );
  }

  if (loading) return <div>충전소 정보를 불러오는 중...</div>;
  
  // 에러가 있어도 stations가 있으면 표시 (기본 형태 포함)
  if (error && stations.length === 0) return (
    <div style={{padding: '2em'}}>
      <div style={{color: 'red', marginBottom: '1em'}}>{error}</div>
      <button onClick={() => window.location.reload()}>새로고침</button>
    </div>
  );

  // 요약 페이지
  if (page === -1) {
    return (
      <div className="App">
        {/* 햄버거 메뉴 */}
        <div className="hamburger-menu">
          <button 
            className="hamburger-button"
            onClick={() => setShowMenu(!showMenu)}
          >
            ☰
          </button>
          
          {showMenu && (
            <div className="menu-dropdown">
              <button 
                className="menu-item success"
                onClick={() => requireAuth(
                  () => setAutoRefresh(!autoRefresh),
                  `자동새로고침 ${autoRefresh ? 'OFF' : 'ON'}`
                )}
              >
                {autoRefresh ? '⏸️ 자동새로고침 OFF' : '▶️ 자동새로고침 ON'}
              </button>
              
              <button 
                className="menu-item"
                onClick={() => requireAuth(
                  () => fetchStations(),
                  '수동 새로고침'
                )}
                disabled={loading}
              >
                {loading ? '🔄 새로고침 중...' : '🔄 수동 새로고침'}
              </button>
              
              <button 
                className="menu-item danger"
                onClick={() => requireAuth(
                  () => {
                    setCookie('areaCode', '');
                    setAreaCode('');
                  },
                  '구역 변경'
                )}
              >
                🚪 구역 변경
              </button>
              
              <button 
                className="menu-item danger"
                onClick={() => requireAuth(
                  () => {
                    auth.signOut();
                    setUser(null);
                    setShowLogin(true);
                  },
                  '로그아웃'
                )}
              >
                🚪 로그아웃
              </button>
            </div>
          )}
        </div>

        <h2>충전소 현황 - {areaCode} 구역</h2>

        {error && (
          <div style={{
            backgroundColor: '#fff3cd', 
            color: '#856404', 
            padding: '10px', 
            borderRadius: '5px', 
            marginBottom: '15px',
            border: '1px solid #ffeaa7'
          }}>
            ⚠️ {error}
          </div>
        )}

        {lastUpdated && (
          <div style={{fontSize: '14px', color: '#666', marginBottom: '15px'}}>
            마지막 업데이트: {lastUpdated.toLocaleTimeString()} 
            {autoRefresh && ' (1분마다 자동 업데이트)'}
          </div>
        )}
        
        {/* 범례 */}
        <div className="legend">
          <div className="legend-item">
            <div className="legend-color station-available"></div>
            <span>사용 가능</span>
          </div>
          <div className="legend-item">
            <div className="legend-color station-charging"></div>
            <span>충전 중</span>
          </div>
          <div className="legend-item">
            <div className="legend-color station-illegal"></div>
            <span>불법 주차</span>
          </div>
        </div>

        {/* 주차장 평면도 */}
        <div className="parking-lot">
          {stations.map((station, index) => {
            const status = getStationStatus(station);
            return (
              <div
                key={station.id}
                className={`charging-station station-${status}`}
                onClick={() => handleStationClick(index)}
              >
                <div className="station-id">{station.id}</div>
                <div className="station-info">
                  {station.carNum && (
                    <div className="car-number">
                      차량: {maskCarNum(station.carNum)}
                    </div>
                  )}
                  {station.chargingTime > 0 && (
                    <div>충전시간: {station.chargingTime}분</div>
                  )}
                  {station.isIllegal && (
                    <div>⚠️ 불법주차</div>
                  )}
                  {!station.carNum && <div>비어있음</div>}
                </div>
              </div>
            );
          })}
        </div>

        {/* 네비게이션 도움말 */}
        <div className="navigation-help">
          💡 충전소를 클릭하여 상세 정보를 확인하세요 | 손가락 1개를 들면 종합 정보 바로가기, 손가락 2개를 들면 오른쪽으로 이동, 손가락 3개를 들면 왼쪽으로 이동| 오른쪽 위 ☰ 메뉴
        </div>

        {/* 인증 모달 */}
        {showAuthModal && (
          <div className="auth-modal">
            <div className="auth-modal-content">
              <div className="auth-modal-header">
                <h3 className="modal-title">관리자 인증</h3>
              </div>
              
              <div className="auth-modal-body">
                <p className="modal-text">
                  "{authAction?.actionName}" 작업을 위해 인증번호를 입력하세요.
                </p>
                <input
                  type="password"
                  className="auth-input"
                  placeholder="인증번호 입력"
                  value={authInput}
                  onChange={(e) => setAuthInput(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleAuthConfirm()}
                  autoFocus
                />
              </div>
              
              <div className="auth-modal-footer">
                <div className="auth-buttons">
                  <button className="auth-confirm" onClick={handleAuthConfirm}>
                    확인
                  </button>
                  <button className="auth-cancel" onClick={handleAuthCancel}>
                    취소
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // 상세 페이지
  const station = stations[page];
  const status = getStationStatus(station);
  
  return (
    <div className="App">
      <div className="detail-panel">
        <div className="detail-title">
          🔌 {station.id} 충전소 상세 정보
        </div>
        
        <div className="detail-info">
          <div className="detail-item">
            <strong>충전소 번호</strong><br/>
            {station.id}
          </div>
          
          <div className="detail-item">
            <strong>상태</strong><br/>
            {status === 'available' && '🟢 사용 가능'}
            {status === 'charging' && '🔵 충전 중'}
            {status === 'illegal' && '🔴 불법 주차'}
          </div>
          
          <div className="detail-item">
            <strong>차량 번호</strong><br/>
            {station.carNum ? maskCarNum(station.carNum) : '없음'}
          </div>
          
          <div className="detail-item">
            <strong>충전 시간</strong><br/>
            {station.chargingTime ? `${station.chargingTime}분` : '충전 안함'}
          </div>
          
          <div className="detail-item">
            <strong>불법 주차</strong><br/>
            {station.isIllegal ? '🚨 예' : '✅ 아니오'}
          </div>
          
          <div className="detail-item">
            <strong>위치</strong><br/>
            {areaCode} 구역
          </div>
        </div>

        <div style={{marginTop: '30px'}}>
          <button onClick={handleBackToSummary}>
            📋 전체 현황 보기
          </button>
          {page > 0 && (
            <button onClick={() => setPage(page - 1)}>
              ⬅️ 이전 충전소
            </button>
          )}
          {page < stations.length - 1 && (
            <button onClick={() => setPage(page + 1)}>
              ➡️ 다음 충전소
            </button>
          )}
        </div>
      </div>
      
      <div className="navigation-help">
        💡 키보드: 좌/우 화살표로 이동, Enter로 전체 현황
      </div>
    </div>
  );
}

export default App;
