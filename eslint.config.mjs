import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    // The dashboard sections have been migrated to `shared/useAdminFetch`, which
    // derives `loading` from the in-flight request instead of assigning it in an
    // effect. Everything below still uses the older fetch-on-mount shape, where
    // the token guard and the loading reset run synchronously in the effect body.
    // Clearing those means reworking how each screen tracks its request state, so
    // they are scoped off here rather than silently degraded — remove a path from
    // this list as it moves onto the hook.
    files: [
      "src/app/dashboard/layout.tsx",
      "src/app/dashboard/streaming/**",
      "src/components/admin/admin-login.tsx",
      "src/components/admin/dashboard/RechargeOfferPanel.tsx",
      "src/components/admin/dashboard/notifications/**",
      "src/components/admin/dashboard/screening/**",
    ],
    rules: {
      "react-hooks/set-state-in-effect": "off",
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
