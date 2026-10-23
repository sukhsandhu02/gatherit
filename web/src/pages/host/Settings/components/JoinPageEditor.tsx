import { useState } from 'react';
import { Save, Eye } from 'lucide-react';

interface JoinPageFields {
  title: string;
  subtitle: string;
  instructions: string;
  joinButton: string;
  loginButton: string;
  namePlaceholder: string;
  phonePlaceholder: string;
  passwordPlaceholder: string;
  nameRequired: boolean;
  phoneRequired: boolean;
  passwordRequired: boolean;
  pendingNote: string;
  blockedNote: string;
}

interface JoinPageEditorProps {
  initial: JoinPageFields;
  saving: boolean;
  onSave: (fields: JoinPageFields) => Promise<void>;
  onLivePreview: () => void;
}

const DEFAULTS: JoinPageFields = {
  title: 'Join the event',
  subtitle: '',
  instructions: '',
  joinButton: 'Join event',
  loginButton: 'Log in',
  namePlaceholder: 'Your name',
  phonePlaceholder: 'Phone number',
  passwordPlaceholder: 'Password',
  nameRequired: true,
  phoneRequired: true,
  passwordRequired: true,
  pendingNote: '',
  blockedNote: '',
};

export function JoinPageEditor({ initial, saving, onSave, onLivePreview }: JoinPageEditorProps) {
  const [fields, setFields] = useState<JoinPageFields>(() => ({
    ...DEFAULTS,
    ...initial,
  }));

  const update = (key: keyof JoinPageFields, value: string | boolean) => {
    setFields((prev) => ({ ...prev, [key]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSave(fields);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="grid sm:grid-cols-2 gap-4">
        <Field
          label="Page title"
          placeholder="Join the event"
          value={fields.title}
          onChange={(v) => update('title', v)}
          help="Main heading on the public join page."
        />
        <Field
          label="Subtitle"
          placeholder="One QR code, every guest a camera."
          value={fields.subtitle}
          onChange={(v) => update('subtitle', v)}
          help="Short line under the title."
        />
      </div>

      <Field
        label="Instructions"
        placeholder="Share this link or its QR code so guests can join the event."
        value={fields.instructions}
        onChange={(v) => update('instructions', v)}
        help="Optional paragraph between the title and the form."
        multiline
      />

      <div className="grid sm:grid-cols-2 gap-4">
        <Field
          label="Join button text"
          placeholder="Join event"
          value={fields.joinButton}
          onChange={(v) => update('joinButton', v)}
        />
        <Field
          label="Log in button text"
          placeholder="Log in"
          value={fields.loginButton}
          onChange={(v) => update('loginButton', v)}
        />
      </div>

      <div className="grid sm:grid-cols-3 gap-4">
        <Field
          label="Name field placeholder"
          placeholder="Your name"
          value={fields.namePlaceholder}
          onChange={(v) => update('namePlaceholder', v)}
        />
        <Field
          label="Phone field placeholder"
          placeholder="Phone number"
          value={fields.phonePlaceholder}
          onChange={(v) => update('phonePlaceholder', v)}
        />
        <Field
          label="Password field placeholder"
          placeholder="Password"
          value={fields.passwordPlaceholder}
          onChange={(v) => update('passwordPlaceholder', v)}
        />
      </div>

      <div>
        <label className="flex items-center gap-3 p-3.5 rounded-2xl border border-[#e2dcce] dark:border-[#332b25] hover:border-[#cfc6b5] dark:hover:border-[#423932] cursor-pointer transition">
          <input
            type="checkbox"
            checked={fields.nameRequired}
            onChange={(e) => update('nameRequired', e.target.checked)}
            className="accent-terracotta-600"
          />
          <div>
            <span className="text-sm font-semibold text-sand-900 dark:text-sand-100">Require name</span>
            <p className="text-xs text-sand-500 dark:text-sand-400 mt-0.5">Guests must fill in the name field to join.</p>
          </div>
        </label>
      </div>

      <div>
        <label className="flex items-center gap-3 p-3.5 rounded-2xl border border-[#e2dcce] dark:border-[#332b25] hover:border-[#cfc6b5] dark:hover:border-[#423932] cursor-pointer transition">
          <input
            type="checkbox"
            checked={fields.phoneRequired}
            onChange={(e) => update('phoneRequired', e.target.checked)}
            className="accent-terracotta-600"
          />
          <div>
            <span className="text-sm font-semibold text-sand-900 dark:text-sand-100">Require phone</span>
            <p className="text-xs text-sand-500 dark:text-sand-400 mt-0.5">Guests must fill in the phone field to join.</p>
          </div>
        </label>
      </div>

      <div>
        <label className="flex items-center gap-3 p-3.5 rounded-2xl border border-[#e2dcce] dark:border-[#332b25] hover:border-[#cfc6b5] dark:hover:border-[#423932] cursor-pointer transition">
          <input
            type="checkbox"
            checked={fields.passwordRequired}
            onChange={(e) => update('passwordRequired', e.target.checked)}
            className="accent-terracotta-600"
          />
          <div>
            <span className="text-sm font-semibold text-sand-900 dark:text-sand-100">Require password</span>
            <p className="text-xs text-sand-500 dark:text-sand-400 mt-0.5">Guests must fill in the password field to join.</p>
          </div>
        </label>
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <Field
          label="Pending approval note"
          placeholder="You’re on the list. We’ll let you in once the host approves."
          value={fields.pendingNote}
          onChange={(v) => update('pendingNote', v)}
          help="Shown when a guest is pending approval."
          multiline
        />
        <Field
          label="Blocked note"
          placeholder="This account has been blocked by the host."
          value={fields.blockedNote}
          onChange={(v) => update('blockedNote', v)}
          help="Shown when a guest is blocked."
          multiline
        />
      </div>

      <div className="flex items-center justify-between pt-2 border-t border-[#e2dcce] dark:border-[#332b25]">
        <button
          type="button"
          onClick={onLivePreview}
          disabled={saving}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold text-sand-700 dark:text-sand-300 hover:bg-[#f5f2ec] dark:hover:bg-[#201c19] border border-[#e2dcce] dark:border-[#332b25] transition disabled:opacity-50"
        >
          <Eye className="w-3.5 h-3.5" />
          Open live preview
        </button>

        <button
          type="submit"
          disabled={saving}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-terracotta-600 hover:bg-terracotta-500 disabled:bg-terracotta-400 text-white text-xs font-semibold transition shadow-xs"
        >
          <Save className="w-3.5 h-3.5" />
          {saving ? 'Saving…' : 'Save join page'}
        </button>
      </div>
    </form>
  );
}

function Field({
  label,
  placeholder,
  value,
  onChange,
  help,
  multiline,
}: {
  label: string;
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
  help?: string;
  multiline?: boolean;
}) {
  return (
    <div className="space-y-1.5">
      <label className="block text-xs font-semibold text-sand-700 dark:text-sand-300">{label}</label>
      {multiline ? (
        <textarea
          className="w-full min-h-[120px] px-3.5 py-2.5 rounded-xl bg-[#f5f2ec] dark:bg-[#141210] border border-[#e2dcce] dark:border-[#2f2822] text-sm text-sand-900 dark:text-sand-100 placeholder-sand-400 dark:placeholder-sand-600 focus:outline-none focus:border-terracotta-500 resize-y"
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      ) : (
        <input
          type="text"
          className="w-full px-3.5 py-2.5 rounded-xl bg-[#f5f2ec] dark:bg-[#141210] border border-[#e2dcce] dark:border-[#2f2822] text-sm text-sand-900 dark:text-sand-100 placeholder-sand-400 dark:placeholder-sand-600 focus:outline-none focus:border-terracotta-500"
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      )}
      {help && <p className="text-[11px] text-sand-500 dark:text-sand-400">{help}</p>}
    </div>
  );
}
