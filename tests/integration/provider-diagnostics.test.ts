import assert from 'node:assert/strict';
import { vi } from 'vitest';
import { integrationTest,testEnvironment } from './helpers';
import { withRuntimeEnvironment } from '../../cloudflare/src/backend/shared/env';
import { providerDiagnostics } from '../../cloudflare/src/backend/shared/provider-diagnostics';

integrationTest('Worker log diagnostics bind the configured service and never forward raw request contents',async()=>{
  let requestBody:Record<string,unknown>={};
  const fetch=vi.spyOn(globalThis,'fetch').mockImplementation(async(_input,init)=>{
    requestBody=JSON.parse(String(init?.body));
    return Response.json({success:true,result:{events:{events:[{
      $metadata:{id:'trace-id',service:'novae-test',level:'error',message:'must-not-leak'},
      source:{authorization:'must-not-leak',body:'private-body'},
    }]}}});
  });
  try {
    const result=await withRuntimeEnvironment({...testEnvironment,OPERATIONS_CLOUDFLARE_ACCOUNT_ID:'test-account',OPERATIONS_CLOUDFLARE_TOKEN:'test-token',OPERATIONS_WORKER_NAME:'novae-test'},()=>providerDiagnostics('logs'));
    assert.equal(result.status,'available');
    assert.equal(requestBody.dry,true);
    assert.ok(JSON.stringify(requestBody.parameters).includes('novae-test'));
    assert.ok(!JSON.stringify(result).includes('must-not-leak'));
    assert.ok(!JSON.stringify(result).includes('private-body'));
    assert.ok(JSON.stringify(result).includes('trace-id'));
  } finally { fetch.mockRestore(); }
});
