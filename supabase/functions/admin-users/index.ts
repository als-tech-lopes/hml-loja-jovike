import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const permissionKeys = new Set(["dashboard", "products", "movements", "sales", "reports"]);

function getCorsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get("Origin");
  const allowedOrigins = (Deno.env.get("ALLOWED_ORIGINS") ?? "http://localhost:8080,http://127.0.0.1:8080,http://localhost:5173,http://127.0.0.1:5173")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);

  return {
    ...(origin && allowedOrigins.includes(origin) ? { "Access-Control-Allow-Origin": origin } : {}),
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
}

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  const requestOrigin = req.headers.get("Origin");
  if (requestOrigin && !corsHeaders["Access-Control-Allow-Origin"]) {
    return new Response(JSON.stringify({ error: "Origem não permitida" }), {
      status: 403,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Método não permitido" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

    // Verify caller is admin
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const anonKey = Deno.env.get("SUPABASE_PUBLISHABLE_KEY") || Deno.env.get("SUPABASE_ANON_KEY")!;
    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user: caller } } = await callerClient.auth.getUser();
    if (!caller) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { data: roleCheck } = await supabaseAdmin.from("user_roles").select("role").eq("user_id", caller.id).maybeSingle();
    if (roleCheck?.role !== "admin" && roleCheck?.role !== "super_admin") {
      return new Response(JSON.stringify({ error: "Acesso negado" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const { data: callerProfile, error: callerProfileError } = await supabaseAdmin
      .from("profiles")
      .select("is_active")
      .eq("user_id", caller.id)
      .maybeSingle();
    if (callerProfileError) throw callerProfileError;
    if (!callerProfile?.is_active) {
      return new Response(JSON.stringify({ error: "Conta inativa" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const callerRole = roleCheck.role;

    const body = await req.json();
    const { action } = body;
    const allowedActions = new Set(["create", "update", "toggle_active", "delete"]);
    if (!allowedActions.has(action)) {
      return new Response(JSON.stringify({ error: "Ação inválida" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (action === "create") {
      const { name, email, password, role = "user", permissions } = body;
      if (!["user", "admin", "super_admin"].includes(role)) {
        return new Response(JSON.stringify({ error: "Perfil inválido" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      if (callerRole === "admin" && role !== "user") {
        return new Response(JSON.stringify({ error: "Administradores só podem criar usuários comuns" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      if (permissions !== undefined && (
        !permissions
        || typeof permissions !== "object"
        || Array.isArray(permissions)
        || Object.entries(permissions).some(([key, value]) => !permissionKeys.has(key) || typeof value !== "boolean")
      )) {
        return new Response(JSON.stringify({ error: "Permissões inválidas" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      if (!name?.trim() || !email?.trim() || !password) {
        return new Response(JSON.stringify({ error: "Nome, e-mail e senha são obrigatórios" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
        email: email.trim().toLowerCase(),
        password,
        email_confirm: true,
        user_metadata: { name: name.trim() },
      });
      if (createError) {
        return new Response(JSON.stringify({ error: createError.message }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      // Set role
      if (role && role !== "user") {
        const { error: roleError } = await supabaseAdmin
          .from("user_roles")
          .update({ role })
          .eq("user_id", newUser.user.id)
          .select("user_id")
          .single();
        if (roleError) {
          await supabaseAdmin.auth.admin.deleteUser(newUser.user.id);
          return new Response(JSON.stringify({ error: `Não foi possível definir o perfil: ${roleError.message}` }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }
      }

      // Set permissions if provided
      if (permissions) {
        const { error: permissionsError } = await supabaseAdmin
          .from("module_permissions")
          .update(permissions)
          .eq("user_id", newUser.user.id)
          .select("user_id")
          .single();
        if (permissionsError) {
          await supabaseAdmin.auth.admin.deleteUser(newUser.user.id);
          return new Response(JSON.stringify({ error: `Não foi possível definir as permissões: ${permissionsError.message}` }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }
      }

      return new Response(JSON.stringify({ success: true, userId: newUser.user.id }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (action === "update") {
      const { userId, name, email, password, role } = body;
      if (!userId) {
        return new Response(JSON.stringify({ error: "Usuário não informado" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      const { data: targetRole, error: targetRoleError } = await supabaseAdmin.from("user_roles").select("role").eq("user_id", userId).maybeSingle();
      if (targetRoleError) throw targetRoleError;
      if (!targetRole) {
        return new Response(JSON.stringify({ error: "Usuário não encontrado" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      if (callerRole === "admin" && targetRole?.role !== "user") {
        return new Response(JSON.stringify({ error: "Administradores só podem alterar usuários comuns" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      if (role && !["user", "admin", "super_admin"].includes(role)) {
        return new Response(JSON.stringify({ error: "Perfil inválido" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      // Admin cannot change roles
      if (callerRole === "admin" && role && role !== targetRole?.role) {
        return new Response(JSON.stringify({ error: "Apenas o Super Admin pode alterar perfis" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      // Update auth user
      const updateData: Record<string, unknown> = {};
      if (email) updateData.email = email;
      if (password) updateData.password = password;
      if (name) updateData.user_metadata = { name };

      if (Object.keys(updateData).length > 0) {
        const { error } = await supabaseAdmin.auth.admin.updateUserById(userId, updateData);
        if (error) {
          return new Response(JSON.stringify({ error: error.message }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }
      }

      // Update profile
      const profileUpdate: Record<string, unknown> = {};
      if (name) profileUpdate.name = name;
      if (email) profileUpdate.email = email;
      if (Object.keys(profileUpdate).length > 0) {
        const { error: profileError } = await supabaseAdmin
          .from("profiles")
          .update(profileUpdate)
          .eq("user_id", userId)
          .select("user_id")
          .single();
        if (profileError) throw profileError;
      }

      // Update role - only super_admin can do this
      if (role && callerRole === "super_admin") {
        const { error: roleError } = await supabaseAdmin
          .from("user_roles")
          .update({ role })
          .eq("user_id", userId)
          .select("user_id")
          .single();
        if (roleError) throw roleError;
      }

      return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (action === "toggle_active") {
      const { userId, is_active } = body;
      if (!userId || typeof is_active !== "boolean") {
        return new Response(JSON.stringify({ error: "Dados inválidos" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      if (userId === caller.id) {
        return new Response(JSON.stringify({ error: "Você não pode alterar o estado da própria conta" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const { data: targetRole, error: targetRoleError } = await supabaseAdmin.from("user_roles").select("role").eq("user_id", userId).maybeSingle();
      if (targetRoleError) throw targetRoleError;
      if (!targetRole) {
        return new Response(JSON.stringify({ error: "Usuário não encontrado" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      if (callerRole === "admin" && targetRole?.role !== "user") {
        return new Response(JSON.stringify({ error: "Administradores só podem alterar usuários comuns" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      
      // Ban/unban in auth
      const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(
        userId,
        { ban_duration: is_active ? "none" : "876600h" },
      );
      if (authError) throw authError;

      // Update profile
      const { data: updatedProfile, error: profileError } = await supabaseAdmin
        .from("profiles")
        .update({ is_active })
        .eq("user_id", userId)
        .select("user_id")
        .maybeSingle();
      if (profileError) throw profileError;
      if (!updatedProfile) throw new Error("Perfil do usuário não encontrado");

      return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (action === "delete") {
      const { userId } = body;
      if (!userId || userId === caller.id) {
        return new Response(JSON.stringify({ error: "Não é possível excluir a própria conta" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const { data: targetRole, error: targetRoleError } = await supabaseAdmin.from("user_roles").select("role").eq("user_id", userId).maybeSingle();
      if (targetRoleError) throw targetRoleError;
      if (!targetRole) {
        return new Response(JSON.stringify({ error: "Usuário não encontrado" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      if (callerRole === "admin" && targetRole.role !== "user") {
        return new Response(JSON.stringify({ error: "Administradores só podem excluir usuários comuns" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      // Soft delete prevents historical sales and owned Storage objects from
      // blocking account removal. The application records are removed below.
      const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(userId, true);
      if (deleteError) throw deleteError;

      const cleanupResults = await Promise.all([
        supabaseAdmin.from("module_permissions").delete().eq("user_id", userId),
        supabaseAdmin.from("user_roles").delete().eq("user_id", userId),
        supabaseAdmin.from("profiles").delete().eq("user_id", userId),
      ]);
      const cleanupError = cleanupResults.find((result) => result.error)?.error;
      if (cleanupError) throw cleanupError;
      return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({ error: "Ação inválida" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro interno no servidor";
    return new Response(JSON.stringify({ error: message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
