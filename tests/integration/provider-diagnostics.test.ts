import assert from 'node:assert/strict';
import { vi } from 'vitest';
import { integrationTest,testEnvironment } from './helpers';
import { withRuntimeEnvironment } from '../../cloudflare/src/backend/shared/env';
import { providerDiagnostics } from '../../cloudflare/src/backend/shared/provider-diagnostics';

integrationTest('backup diagnostics distinguish artifacts from successful skipped runs and expose further pages',async()=>{
  const fetch = vi.spyOn(globalThis,'fetch').mockImplementation(async input=>{
    const url=String(input);
    if(url.includes('/artifacts?')) return Response.json({total_count:201,artifacts:[
      {id:1,name:'novae-neon-1-1',expired:false,size_in_bytes:100,digest:'sha256:test'},
      {id:2,name:'novae-neon-2-1',expired:true},
      {id:3,name:'unrelated-build',expired:false},
    ]});
    return Response.json({workflow_runs:[{id:1,status:'completed',conclusion:'success'}]});
  });
  try {
    const result=await withRuntimeEnvironment({...testEnvironment,OPERATIONS_GITHUB_TOKEN:'test-token',OPERATIONS_GITHUB_REPOSITORY:'example/novae'},()=>providerDiagnostics('backups',{cursor:'2'}));
    assert.equal(result.status,'available');
    assert.equal('nextCursor' in result && result.nextCursor,'3');
    const data=result.data as {artifacts:unknown[];artifactPage:number};
    assert.equal(data.artifacts.length,1);
    assert.equal(data.artifactPage,2);
    assert.ok(fetch.mock.calls.some(([url])=>String(url).includes('page=2')));
    assert.ok(!JSON.stringify(result).includes('test-token'));
  } finally { fetch.mockRestore(); }
});

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
