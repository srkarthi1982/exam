import { ActionError, type ActionAPIContext } from "astro:actions";

type AuthUser = NonNullable<App.Locals["user"]>;

export const requireUser = (context: ActionAPIContext): AuthUser => {
  const locals = context.locals as App.Locals | undefined;
  const user = locals?.user;
  if (!locals?.isAuthenticated || !user) {
    throw new ActionError({ code: "UNAUTHORIZED", message: "Sign in required" });
  }
  return user as AuthUser;
};

export const requirePro = (context: ActionAPIContext): AuthUser => {
  const user = requireUser(context);
  if (!user?.isPaid) {
    throw new ActionError({ code: "PAYMENT_REQUIRED", message: "Pro access required" });
  }
  return user;
};
