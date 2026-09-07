import { PASSWORD_RULES } from "@/lib/password-policy";

/**
 * The password policy, shown to the person choosing one.
 *
 * The labels come from the same constant the server validates against, so the
 * list cannot drift out of step with what is actually enforced. This is a hint
 * to the reader, not a check: the real validation happens in the server action,
 * where it cannot be skipped.
 */
export function PasswordRules() {
  return (
    <ul className="pw-rules">
      {PASSWORD_RULES.map((rule) => (
        <li key={rule.id}>
          <i className="ph ph-circle" aria-hidden="true" />
          <span>{rule.label}</span>
        </li>
      ))}
    </ul>
  );
}
