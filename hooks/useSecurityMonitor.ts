import { useEffect } from 'react';
import { isSecureContext, logSecurityEvent, sanitizeInput } from '../utils/security';

const serializeReason = (reason: unknown): string | undefined => {
  if (!reason) return undefined;

  if (typeof reason === 'string') {
    return sanitizeInput(reason);
  }

  if (reason instanceof Error) {
    return sanitizeInput(reason.message);
  }

  try {
    return sanitizeInput(JSON.stringify(reason));
  } catch {
    return undefined;
  }
};

export const useSecurityMonitor = (): void => {
  useEffect(() => {
    if (typeof window !== 'undefined' && !isSecureContext()) {
      logSecurityEvent('INSECURE_CONTEXT_DETECTED', {
        protocol: window.location.protocol,
        host: window.location.host,
      });
    }

    const handleCSPViolation = (event: SecurityPolicyViolationEvent) => {
      logSecurityEvent('CSP_VIOLATION', {
        blockedURI: event.blockedURI,
        violatedDirective: event.violatedDirective,
        originalPolicy: event.originalPolicy,
        sourceFile: event.sourceFile,
        lineNumber: event.lineno,
        columnNumber: event.colno,
      });
    };

    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      logSecurityEvent('UNHANDLED_PROMISE_REJECTION', {
        reason: serializeReason(event.reason),
      });
    };

    const handleError = (event: ErrorEvent) => {
      logSecurityEvent('UNCAUGHT_RUNTIME_ERROR', {
        message: sanitizeInput(event.message),
        source: event.filename,
        line: event.lineno,
        column: event.colno,
      });
    };

    const handleMessage = (event: MessageEvent) => {
      if (typeof window === 'undefined') return;
      const sameOrigin = event.origin === window.location.origin;
      if (!sameOrigin) {
        logSecurityEvent('CROSS_ORIGIN_MESSAGE_BLOCKED', {
          origin: event.origin,
          dataType: typeof event.data,
        });
      }
    };

    window.addEventListener('securitypolicyviolation', handleCSPViolation);
    window.addEventListener('unhandledrejection', handleUnhandledRejection);
    window.addEventListener('error', handleError);
    window.addEventListener('message', handleMessage, true);

    return () => {
      window.removeEventListener('securitypolicyviolation', handleCSPViolation);
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);
      window.removeEventListener('error', handleError);
      window.removeEventListener('message', handleMessage, true);
    };
  }, []);
};


