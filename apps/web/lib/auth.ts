type AuthenticatedUser = {
  id: string;
  email?: string | null;
};

type AuthenticatedUserClient<TUser extends AuthenticatedUser = AuthenticatedUser> = {
  auth: {
    getUser: () => Promise<{
      data: {
        user: TUser | null;
      };
    }>;
  };
};

export async function getAuthenticatedUser<TUser extends AuthenticatedUser>(
  supabase: AuthenticatedUserClient<TUser>
) {
  const {
    data: { user }
  } = await supabase.auth.getUser();

  return user;
}