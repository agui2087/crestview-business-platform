const repository='agui2087/crestview-business-platform';
const title='[Backup monitor] Crestview restore verification needs attention';
const marker='<!-- crestview-backup-monitor:v1 -->';

// workflow_run is privileged: never execute the triggering branch or read its
// logs/artifacts. Only allowlisted metadata reaches this public incident.
export async function reportBackupIncident({github,context}){
  if(`${context.repo?.owner}/${context.repo?.repo}`!==repository)return 'ignored';
  const scope={owner:context.repo.owner,repo:context.repo.repo};
  let run=context.payload?.workflow_run;
  if(context.eventName==='push'&&context.ref==='refs/heads/main'){
    const history=await github.request('GET /repos/{owner}/{repo}/actions/workflows/{workflow_id}/runs',{
      ...scope,workflow_id:'backup-restore-drill.yml',branch:'main',status:'completed',per_page:1,
    });
    run=history.data.workflow_runs?.[0];
  }else if(context.eventName!=='workflow_run'||context.payload?.action!=='completed')return 'ignored';
  if(
    run?.head_repository?.full_name!==repository||run?.head_branch!=='main'||
    run?.name!=='Encrypted backup and restore drill'||run?.status!=='completed'||
    !['schedule','workflow_dispatch'].includes(run?.event)||
    !Number.isSafeInteger(run?.id)||run.id<1||!Number.isSafeInteger(run?.workflow_id)||
    !Number.isSafeInteger(run?.run_attempt)||run.run_attempt<1||
    !['success','failure','cancelled','timed_out','action_required','stale','neutral','skipped','startup_failure'].includes(run?.conclusion))return 'ignored';
  const latest=await github.request('GET /repos/{owner}/{repo}/actions/workflows/{workflow_id}/runs',{
    ...scope,workflow_id:run.workflow_id,branch:'main',status:'completed',per_page:1,
  });
  const newest=latest.data.workflow_runs?.[0];
  if(newest?.id!==run.id||newest?.run_attempt!==run.run_attempt||newest?.conclusion!==run.conclusion)return 'stale';
  const issues=await github.paginate(github.rest.issues.listForRepo,{...scope,state:'open',per_page:100});
  const managed=issues.filter(issue=>!issue.pull_request&&issue.title===title&&issue.user?.login==='github-actions[bot]'&&issue.body?.includes(marker));
  const runMarker=`<!-- crestview-backup-run:${run.id}:${run.run_attempt} -->`;
  const url=`https://github.com/${repository}/actions/runs/${run.id}`;
  if(run.conclusion==='success'){
    for(const issue of managed){
      await github.rest.issues.createComment({...scope,issue_number:issue.number,body:`${runMarker}\nThe latest automated backup/restore drill passed: ${url}\nThis closes the workflow incident, not the separate application-level recovery review.`});
      await github.rest.issues.update({...scope,issue_number:issue.number,state:'closed',state_reason:'completed'});
    }
    return managed.length?'recovered':'healthy';
  }
  const body=`${marker}\n${runMarker}\nThe latest production backup/restore drill did not pass (${run.conclusion}). Recoverability is not verified by this run.\n\nRun: ${url}\n\nFollow docs/backup-activation.md and docs/reliability-and-recovery-runbook.md. Check configuration, encrypted artifact availability, isolated restore and cleanup. Do not restore into production or post credentials, customer data, or raw logs here.`;
  const issue=managed[0];
  if(!issue){await github.rest.issues.create({...scope,title,body});return 'opened';}
  if(issue.body.includes(runMarker))return 'unchanged';
  const comments=await github.paginate(github.rest.issues.listComments,{...scope,issue_number:issue.number,per_page:100});
  if(comments.some(comment=>comment.user?.login==='github-actions[bot]'&&comment.body?.includes(runMarker)))return 'unchanged';
  await github.rest.issues.createComment({...scope,issue_number:issue.number,body});
  return 'updated';
}
