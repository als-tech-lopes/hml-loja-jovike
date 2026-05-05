import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
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
    const callerRole = roleCheck.role;

    const body = await req.json();
    const { action } = body;

    // Admin restrictions: cannot create or delete users
    if (callerRole === "admin" && (action === "create" || action === "delete")) {
      return new Response(JSON.stringify({ error: "Apenas o Super Admin pode realizar esta ação" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (action === "create") {
      // Only super_admin reaches here
      const { name, email, password, role = "user", permissions } = body;
      const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { name },
      });
      if (createError) {
        return new Response(JSON.stringify({ error: createError.message }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      // Set role
      if (role && role !== "user") {
        await supabaseAdmin.from("user_roles").update({ role }).eq("user_id", newUser.user.id);
      }

      // Set permissions if provided
      if (permissions) {
        await supabaseAdmin.from("module_permissions").update(permissions).eq("user_id", newUser.user.id);
      }

      return new Response(JSON.stringify({ success: true, userId: newUser.user.id }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (action === "update") {
      const { userId, name, email, password, role } = body;

      // Admin cannot change roles
      if (callerRole === "admin" && role) {
        // Check if trying to change the role - get current role
        const { data: targetRole } = await supabaseAdmin.from("user_roles").select("role").eq("user_id", userId).maybeSingle();
        if (targetRole?.role === "super_admin") {
          return new Response(JSON.stringify({ error: "Acesso negado" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }
        // Admin cannot modify role field at all - ignore it
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
        await supabaseAdmin.from("profiles").update(profileUpdate).eq("user_id", userId);
      }

      // Update role - only super_admin can do this
      if (role && callerRole === "super_admin") {
        await supabaseAdmin.from("user_roles").update({ role }).eq("user_id", userId);
      }

      return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (action === "toggle_active") {
      const { userId, is_active } = body;
      
      // Ban/unban in auth
      if (is_active) {
        await supabaseAdmin.auth.admin.updateUserById(userId, { ban_duration: "none" });
      } else {
        await supabaseAdmin.auth.admin.updateUserById(userId, { ban_duration: "876600h" });
      }

      // Update profile
      await supabaseAdmin.from("profiles").update({ is_active }).eq("user_id", userId);

      return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (action === "delete") {
      // Only super_admin reaches here
      const { userId } = body;
      await supabaseAdmin.auth.admin.deleteUser(userId);
      return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({ error: "Ação inválida" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro interno no servidor";
    return new Response(JSON.stringify({ error: message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
