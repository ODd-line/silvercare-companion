import app from 'vinext/server/fetch-handler';
import {deliverWeekly,type EmailEnv} from './lib/care-email-core';

export default {
 fetch: app.fetch,
 async scheduled(controller:ScheduledController,env:EmailEnv,ctx:ExecutionContext){
  ctx.waitUntil(deliverWeekly(env,Math.floor(controller.scheduledTime/1000)));
 },
};
