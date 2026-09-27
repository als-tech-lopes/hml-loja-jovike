const { execSync } = require('node:child_process');
const { createClient } = require('@supabase/supabase-js');

function localSupabaseEnvironment() {
  const npxCommand = process.platform === 'win32' ? 'npx.cmd' : 'npx';
  const raw = execSync(`${npxCommand} supabase status -o env`, { encoding: 'utf8' });
  const values = {};

  for (const line of raw.split(/\r?\n/)) {
    const separator = line.indexOf('=');
    if (separator < 1) continue;
    const key = line.slice(0, separator);
    const rawValue = line.slice(separator + 1).trim();
    values[key] = rawValue.startsWith('"') && rawValue.endsWith('"')
      ? rawValue.slice(1, -1)
      : rawValue;
  }

  const apiUrl = new URL(values.API_URL);
  if (!['127.0.0.1', 'localhost'].includes(apiUrl.hostname)) {
    throw new Error('Este teste só pode ser executado contra o Supabase local.');
  }
  if (!values.SERVICE_ROLE_KEY || !values.ANON_KEY) {
    throw new Error('As chaves do Supabase local não foram encontradas.');
  }

  return values;
}

async function run() {
  const environment = localSupabaseEnvironment();
  const admin = createClient(environment.API_URL, environment.SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const client = createClient(environment.API_URL, environment.ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const suffix = Date.now();
  const callerEmail = `qa.super.${suffix}@example.invalid`;
  const createdEmail = `qa.created.${suffix}@example.invalid`;
  const password = 'TesteSeguro!927A';
  const temporaryUserIds = [];

  try {
    const callerResult = await admin.auth.admin.createUser({
      email: callerEmail,
      password,
      email_confirm: true,
      user_metadata: { name: 'QA Super Admin' },
    });
    if (callerResult.error) throw callerResult.error;
    temporaryUserIds.push(callerResult.data.user.id);

    const roleResult = await admin
      .from('user_roles')
      .update({ role: 'super_admin' })
      .eq('user_id', callerResult.data.user.id);
    if (roleResult.error) throw roleResult.error;

    const loginResult = await client.auth.signInWithPassword({ email: callerEmail, password });
    if (loginResult.error) throw loginResult.error;

    const response = await fetch(`${environment.API_URL}/functions/v1/admin-users`, {
      method: 'POST',
      headers: {
        Origin: 'http://localhost:8080',
        'Content-Type': 'application/json',
        Authorization: `Bearer ${loginResult.data.session.access_token}`,
        apikey: environment.ANON_KEY,
      },
      body: JSON.stringify({
        action: 'create',
        name: 'Usuário QA',
        email: createdEmail,
        password,
        role: 'admin',
      }),
    });
    const payload = await response.json();
    if (!response.ok) throw new Error(`${response.status}: ${payload.error || 'Falha desconhecida'}`);
    temporaryUserIds.push(payload.userId);

    const [profile, role, permissions] = await Promise.all([
      admin.from('profiles').select('name, email, is_active').eq('user_id', payload.userId).single(),
      admin.from('user_roles').select('role').eq('user_id', payload.userId).single(),
      admin.from('module_permissions').select('dashboard, products, movements, sales, reports').eq('user_id', payload.userId).single(),
    ]);
    if (profile.error || role.error || permissions.error) {
      throw new Error('O usuário foi criado sem todos os registros auxiliares.');
    }
    if (role.data.role !== 'admin') throw new Error('O perfil solicitado não foi aplicado.');

    console.log('create_status=200');
    console.log('profile_created=true');
    console.log(`role_created=${role.data.role}`);
    console.log('permissions_created=true');
  } finally {
    for (const userId of temporaryUserIds.reverse()) {
      await admin.auth.admin.deleteUser(userId);
    }
  }

  const remaining = await admin
    .from('profiles')
    .select('id', { count: 'exact', head: true })
    .in('email', [callerEmail, createdEmail]);
  console.log(`temporary_records_remaining=${remaining.count || 0}`);
}

run().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
