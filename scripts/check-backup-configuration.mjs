// Report missing setting names, never credential values or connection strings.
const groups={
  backup:['SUPABASE_DB_URL','NEXT_PUBLIC_SUPABASE_URL','SUPABASE_SERVICE_ROLE_KEY','CRESTVIEW_BACKUP_PASSPHRASE'],
  restore:['RESTORE_SUPABASE_URL','RESTORE_SUPABASE_SERVICE_ROLE_KEY'],
};
const phase=process.argv[2];
if(!Object.hasOwn(groups,phase??'')){
  console.error('Specify backup or restore configuration check.');
  process.exitCode=1;
}else{
  const missing=groups[phase].filter(name=>!process.env[name]?.trim());
  if(missing.length){
    console.error(`Missing GitHub Actions repository secrets: ${missing.join(', ')}.`);
    console.error('Configure these in repository Settings > Secrets and variables > Actions. Vercel and local environment values are not automatically available to GitHub Actions.');
    console.error('Configuration failure: no successful backup or restore is being claimed.');
    process.exitCode=1;
  }else{
    console.log(`${phase} settings are present; credentials and recoverability are not yet verified.`);
  }
}
