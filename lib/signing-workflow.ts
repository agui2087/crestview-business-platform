export type SigningControls = {received_at?:string|null;expires_at?:string|null;withdrawn_at?:string|null;withdrawal_reason?:string|null;last_reminded_at?:string|null};
export function signingState(status:string, controls:SigningControls|null, now=Date.now()) {
  if(status==='signed')return 'signed';
  if(controls?.withdrawn_at)return 'withdrawn';
  if(controls?.expires_at && Date.parse(controls.expires_at)<=now)return 'expired';
  return status;
}
export function mayRemind(status:string, controls:SigningControls|null, now=Date.now()) {
  return ['sent','viewed'].includes(signingState(status,controls,now)) && (!controls?.last_reminded_at||now-Date.parse(controls.last_reminded_at)>=86_400_000);
}
