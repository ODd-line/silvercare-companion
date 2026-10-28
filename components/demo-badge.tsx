'use client';
import {CareInfo} from './care-info';
import {tr,useLanguage} from '@/lib/i18n';
export function DemoBadge(){
 useLanguage();
 return <div className="demo-badge"><span role="status"><strong>{tr('Demo')}</strong><span aria-hidden="true"> · </span>{tr('Sample data')}</span><CareInfo title={tr('Demo')}><p>{tr('Demo preview: sample data only. Changes stay in memory. No real account, booking or caregiver notification.')}</p></CareInfo></div>;
}
