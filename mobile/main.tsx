import "../app/silver-care.css";
import '../app/partners.css';
import React from 'react';
import {createRoot} from 'react-dom/client';
import App from '../app/page';
import {PineTimeWatchPanel,usePineTimeWatch} from '../components/pinetime-watch';
import '../app/globals.css';
import '../app/silver-landing.css';
// Build-time override for local simulator testing; release builds use the hosted API.
(globalThis as any).__SILVER_BANK_API__ = (import.meta as any).env.VITE_TIMEBANK_API_URL || '';
document.documentElement.classList.add('native-app');
function WatchTestApp(){
	const watch=usePineTimeWatch('local-bluetooth-test');
	return <div className="care-shell care-watch-test"><main className="care-main"><img src="/images/brand/silver-plus.jpeg" alt="Silver Plus" width="52" height="52"/><h1>Bluetooth test build</h1><p role="status">Account storage disabled</p><PineTimeWatchPanel watch={watch} showStorage={false}/></main></div>;
}
createRoot(document.getElementById('root')!).render((import.meta as any).env.VITE_WATCH_TEST_MODE==='true'?<WatchTestApp/>:<App/>);
