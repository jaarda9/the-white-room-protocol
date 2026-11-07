import { forwardRef } from 'react';

interface PinInputProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit?: () => void;
  placeholder?: string;
  autoFocus?: boolean;
  disabled?: boolean;
  /** For password managers: 'current-password' when entering, 'new-password' when choosing. */
  autoComplete?: 'current-password' | 'new-password';
}

/** Six-digit PIN field: numeric keypad on phones, masked, digits only. */
const PinInput = forwardRef<HTMLInputElement, PinInputProps>(function PinInput(
  { value, onChange, onSubmit, placeholder = '● ● ● ● ● ●', autoFocus, disabled, autoComplete = 'current-password' },
  ref
) {
  return (
    <input
      ref={ref}
      type="password"
      inputMode="numeric"
      pattern="[0-9]*"
      maxLength={6}
      autoComplete={autoComplete}
      value={value}
      disabled={disabled}
      autoFocus={autoFocus}
      onChange={(e) => onChange(e.target.value.replace(/\D/g, '').slice(0, 6))}
      onKeyDown={(e) => {
        if (e.key === 'Enter' && onSubmit) onSubmit();
      }}
      placeholder={placeholder}
      className="w-full bg-[#061426] border border-white/40 px-4 py-2.5 text-center text-white font-mono text-lg tracking-[0.5em] placeholder:text-gray-600 placeholder:tracking-[0.3em] placeholder:text-sm focus:border-[#00d4ff] outline-none rounded-[2px] disabled:opacity-50"
    />
  );
});

export default PinInput;
