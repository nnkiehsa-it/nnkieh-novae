import { afterEach,expect,it,vi } from 'vitest';
import { waitForWriteCooldown } from '../../src/lib/request';

afterEach(()=>vi.useRealTimers());
it('queues rapid writes rather than dropping the second interaction',async()=>{
  vi.useFakeTimers();
  const key=crypto.randomUUID();
  const completed:number[]=[];
  const start=Date.now();
  const pending=Array.from({length:3},()=>waitForWriteCooldown(key,500).then(()=>completed.push(Date.now()-start)));
  await vi.advanceTimersByTimeAsync(0);
  expect(completed).toEqual([0]);
  await vi.advanceTimersByTimeAsync(1000);
  await Promise.all(pending);
  expect(completed).toEqual([0,500,1000]);
});
it('cancels a queued write before its request can be sent',async()=>{
  vi.useFakeTimers();
  const key=crypto.randomUUID();
  await waitForWriteCooldown(key,500);
  const controller=new AbortController();
  const pending=waitForWriteCooldown(key,500,controller.signal);
  const rejected=expect(pending).rejects.toThrow('Cancelled');
  controller.abort(new Error('Cancelled'));
  await rejected;
  expect(vi.getTimerCount()).toBe(0);
});
