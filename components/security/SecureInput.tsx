import React, { useState, useRef, useEffect } from 'react';
import { sanitizeInput, isValidEmail, isStrongPassword } from '../../utils/security';
import Input from '../ui/Input';

interface SecureInputProps {
  type?: 'text' | 'email' | 'password' | 'tel' | 'url';
  value: string;
  onChange: (value: string) => void;
  label?: string;
  placeholder?: string;
  required?: boolean;
  validateEmail?: boolean;
  validatePassword?: boolean;
  maxLength?: number;
  className?: string;
  disabled?: boolean;
  error?: string;
}

/**
 * SecureInput Component
 * مكون إدخال آمن مع تنظيف تلقائي للبيانات والتحقق من الصحة
 */
const SecureInput: React.FC<SecureInputProps> = ({
  type = 'text',
  value,
  onChange,
  label,
  placeholder,
  required = false,
  validateEmail = false,
  validatePassword = false,
  maxLength = 255,
  className = '',
  disabled = false,
  error: externalError,
}) => {
  const [internalError, setInternalError] = useState<string>('');
  const [touched, setTouched] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // منع نسخ كلمات المرور
    if (type === 'password' && inputRef.current) {
      const handleCopy = (e: ClipboardEvent) => {
        e.preventDefault();
        setInternalError('لا يمكن نسخ كلمة المرور');
        setTimeout(() => setInternalError(''), 3000);
      };

      const handleCut = (e: ClipboardEvent) => {
        e.preventDefault();
        setInternalError('لا يمكن قص كلمة المرور');
        setTimeout(() => setInternalError(''), 3000);
      };

      inputRef.current.addEventListener('copy', handleCopy);
      inputRef.current.addEventListener('cut', handleCut);

      return () => {
        if (inputRef.current) {
          inputRef.current.removeEventListener('copy', handleCopy);
          inputRef.current.removeEventListener('cut', handleCut);
        }
      };
    }
  }, [type]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let newValue = e.target.value;

    // تطبيق الحد الأقصى للطول
    if (newValue.length > maxLength) {
      setInternalError(`الحد الأقصى ${maxLength} حرف`);
      return;
    }

    // تنظيف المدخلات (إلا كلمات المرور)
    if (type !== 'password') {
      newValue = sanitizeInput(newValue);
    }

    onChange(newValue);
    setInternalError('');
  };

  const handleBlur = () => {
    setTouched(true);

    if (required && !value) {
      setInternalError('هذا الحقل مطلوب');
      return;
    }

    // التحقق من البريد الإلكتروني
    if (validateEmail && value && !isValidEmail(value)) {
      setInternalError('البريد الإلكتروني غير صحيح');
      return;
    }

    // التحقق من قوة كلمة المرور
    if (validatePassword && value && !isStrongPassword(value)) {
      setInternalError('كلمة المرور يجب أن تحتوي على 8 أحرف على الأقل، حرف كبير، حرف صغير، ورقم');
      return;
    }

    setInternalError('');
  };

  const displayError = externalError || (touched ? internalError : '');

  return (
    <div className={className}>
      {label && (
        <label className="block text-sm font-medium text-slate-300 mb-2">
          {label}
          {required && <span className="text-red-400 mr-1">*</span>}
        </label>
      )}
      <Input
        ref={inputRef}
        type={type}
        value={value}
        onChange={handleChange}
        onBlur={handleBlur}
        placeholder={placeholder}
        disabled={disabled}
        error={displayError}
        maxLength={maxLength}
        autoComplete={type === 'password' ? 'new-password' : 'off'}
      />
      {displayError && (
        <p className="mt-1 text-sm text-red-400">{displayError}</p>
      )}
      {type === 'password' && value && (
        <div className="mt-2">
          <PasswordStrengthIndicator password={value} />
        </div>
      )}
    </div>
  );
};

/**
 * PasswordStrengthIndicator Component
 * مؤشر قوة كلمة المرور
 */
const PasswordStrengthIndicator: React.FC<{ password: string }> = ({ password }) => {
  const getStrength = (): { level: number; text: string; color: string } => {
    let strength = 0;

    if (password.length >= 8) strength++;
    if (password.length >= 12) strength++;
    if (/[a-z]/.test(password)) strength++;
    if (/[A-Z]/.test(password)) strength++;
    if (/[0-9]/.test(password)) strength++;
    if (/[^a-zA-Z0-9]/.test(password)) strength++;

    if (strength <= 2) return { level: 1, text: 'ضعيفة', color: 'bg-red-500' };
    if (strength <= 4) return { level: 2, text: 'متوسطة', color: 'bg-yellow-500' };
    return { level: 3, text: 'قوية', color: 'bg-green-500' };
  };

  const strength = getStrength();

  return (
    <div className="space-y-1">
      <div className="flex gap-1">
        {[1, 2, 3].map((level) => (
          <div
            key={level}
            className={`h-1 flex-1 rounded ${
              level <= strength.level ? strength.color : 'bg-slate-700'
            }`}
          />
        ))}
      </div>
      <p className="text-xs text-slate-400">قوة كلمة المرور: {strength.text}</p>
    </div>
  );
};

export default SecureInput;

