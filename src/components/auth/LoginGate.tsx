import { useState, type FormEvent, type ReactNode } from 'react';
import { Link, useLocation } from 'wouter';
import { HelpCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { FieldError } from '@/components/ui/field-error';
import { Input } from '@/components/ui/input';
import { PasswordInput } from '@/components/ui/password-input';
import { Label } from '@/components/ui/label';
import { BrandSplash } from '@/components/auth/BrandSplash';
import { CopyableValue } from '@/components/ui/copyable-value';
import { useAuth } from '@/hooks/useAuth';

/** Must match MIN_PASSWORD_LENGTH in server/src/auth-store.ts. */
const MIN_PASSWORD_LENGTH = 8;

function AuthCard({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-xl">{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
        <CardContent>{children}</CardContent>
        <div className="flex justify-center pb-2">
          <Link href="/faq">
            <button
              type="button"
              aria-label="Support & FAQ"
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors duration-150"
            >
              <HelpCircle className="h-3.5 w-3.5" />
              Support & FAQ
            </button>
          </Link>
        </div>
      </Card>
    </div>
  );
}

function RecoveryKeyPanel({
  recoveryKey,
  onDone,
}: {
  recoveryKey: string;
  onDone: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-4 backdrop-blur-sm">
      <AuthCard
        title="Save your recovery key"
        description="This key resets your password if you ever forget it. Your mining configuration is kept."
      >
        <div className="space-y-4">
          <CopyableValue value={recoveryKey} />

          <p className="text-xs text-muted-foreground">
            Store it somewhere safe. If you lose both your password and this key,
            recovering the device means erasing its config volume.
          </p>

          <Button type="button" className="w-full" onClick={onDone}>
            I&apos;ve saved it
          </Button>
        </div>
      </AuthCard>
    </div>
  );
}

function CreatePasswordForm({
  onRecoveryKey,
}: {
  onRecoveryKey: (key: string) => void;
}) {
  const { createPassword } = useAuth();
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [validationError, setValidationError] = useState<string | null>(null);

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();

    if (password.length < MIN_PASSWORD_LENGTH) {
      setValidationError(`Password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
      return;
    }
    if (password !== confirmation) {
      setValidationError('Passwords do not match.');
      return;
    }

    setValidationError(null);
    createPassword.mutate(password, {
      onSuccess: (recoveryKey) => {
        if (recoveryKey) onRecoveryKey(recoveryKey);
      },
    });
  };

  return (
    <AuthCard
      title="Create an admin password"
      description="This password protects your mining setup. Your configuration is preserved across updates and restarts."
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <Label htmlFor="new-password">Password</Label>
          <PasswordInput
            id="new-password"
            autoComplete="new-password"
            autoFocus
            className="mt-1.5"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </div>
        <div>
          <Label htmlFor="confirm-password">Confirm password</Label>
          <PasswordInput
            id="confirm-password"
            autoComplete="new-password"
            className="mt-1.5"
            value={confirmation}
            onChange={(event) => setConfirmation(event.target.value)}
          />
        </div>

        <FieldError message={validationError ?? createPassword.error?.message} />

        <Button type="submit" className="w-full" disabled={createPassword.isPending}>
          {createPassword.isPending ? 'Creating...' : 'Create password'}
        </Button>

        <p className="text-xs text-muted-foreground">
          Store it somewhere safe. Recovering your account requires the recovery key shown on the next screen. If you lose it, you can still recover access by deleting the credential file and creating a new password — your mining configuration will be kept.
        </p>
      </form>
    </AuthCard>
  );
}

function ForgotPasswordDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { recover } = useAuth();
  const [key, setKey] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [recoveredKey, setRecoveredKey] = useState<string | null>(null);

  if (!open) return null;

  const mismatch = confirmPassword.length > 0 && newPassword !== confirmPassword;

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (mismatch) return;
    recover.mutate(
      { recoveryKey: key, newPassword },
      {
        onSuccess: (newRecoveryKey: string | undefined) => {
          setKey('');
          setNewPassword('');
          setConfirmPassword('');
          if (newRecoveryKey) {
            setRecoveredKey(newRecoveryKey);
          } else {
            onOpenChange(false);
          }
        },
      },
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-4 backdrop-blur-sm">
      <AuthCard
        title="Reset your password"
        description="Enter your recovery key and choose a new password. Your mining configuration will be kept."
      >
        {recoveredKey ? (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Password reset successfully. Save your new recovery key — you will need it if you forget your password again.
            </p>
            <CopyableValue value={recoveredKey} />
            <Button className="w-full" onClick={() => onOpenChange(false)}>
              Log in
            </Button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="recovery-key">Recovery key</Label>
              <Input
                id="recovery-key"
                value={key}
                autoFocus
                className="mt-1.5"
                onChange={(event) => setKey(event.target.value)}
              />
            </div>

            <div>
              <Label htmlFor="new-password">New password</Label>
              <PasswordInput
                id="new-password"
                value={newPassword}
                className="mt-1.5"
                onChange={(event) => setNewPassword(event.target.value)}
              />
            </div>

            <div>
              <Label htmlFor="confirm-password">Confirm new password</Label>
              <PasswordInput
                id="confirm-password"
                value={confirmPassword}
                className="mt-1.5"
                onChange={(event) => setConfirmPassword(event.target.value)}
              />
              {mismatch && (
                <p className="mt-1 text-xs text-destructive">Passwords do not match.</p>
              )}
            </div>

            <FieldError message={recover.error?.message} />

            <Button type="submit" className="w-full" disabled={recover.isPending || mismatch}>
              {recover.isPending ? 'Resetting...' : 'Reset password'}
            </Button>

            <Button
              type="button"
              variant="ghost"
              className="w-full"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
          </form>
        )}
      </AuthCard>
    </div>
  );
}

function LoginForm({ recoveryKeySet }: { recoveryKeySet: boolean }) {
  const { login } = useAuth();
  const [password, setPassword] = useState('');
  const [forgotOpen, setForgotOpen] = useState(false);

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    login.mutate(password);
  };

  return (
    <>
      <AuthCard title="Unlock sv2-ui" description="Enter your admin password to manage the mining stack.">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="password">Password</Label>
            <PasswordInput
              id="password"
              autoComplete="current-password"
              autoFocus
              className="mt-1.5"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </div>

          <FieldError message={login.error?.message} />

          <Button type="submit" className="w-full" disabled={login.isPending}>
            {login.isPending ? 'Unlocking...' : 'Unlock'}
          </Button>

          {recoveryKeySet && (
            <div className="text-center">
              <button
                type="button"
                className="text-sm text-muted-foreground underline-offset-4 hover:text-primary hover:underline"
                onClick={() => setForgotOpen(true)}
              >
                Forgot password?
              </button>
            </div>
          )}
        </form>
      </AuthCard>

      <ForgotPasswordDialog open={forgotOpen} onOpenChange={setForgotOpen} />
    </>
  );
}

/**
 * Gates every operational route behind an authenticated principal.
 *
 * This is a UX layer only - the server middleware in server/src/index.ts is the
 * actual enforcement point and returns 401 for the whole control API without a
 * session.
 */
export function LoginGate({ children }: { children: ReactNode }) {
  const { isLoading, isError, refetch, passwordSet, authenticated, recoveryKeySet } = useAuth();
  const [, navigate] = useLocation();
  const [pendingRecoveryKey, setPendingRecoveryKey] = useState<string | null>(null);

  if (isLoading) {
    return <BrandSplash message="Checking access..." />;
  }

  if (isError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="text-xl">Connection error</CardTitle>
            <CardDescription>
              Could not reach the server. This may happen during startup or if the
              configuration is corrupted.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button className="w-full" onClick={() => refetch()}>
              Try again
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const recoveryOverlay = pendingRecoveryKey && (
    <RecoveryKeyPanel
      recoveryKey={pendingRecoveryKey}
      onDone={() => {
        setPendingRecoveryKey(null);
        navigate('/');
      }}
    />
  );

  if (!passwordSet) {
    return (
      <>
        <CreatePasswordForm onRecoveryKey={setPendingRecoveryKey} />
        {recoveryOverlay}
      </>
    );
  }

  if (!authenticated) {
    return (
      <>
        <LoginForm recoveryKeySet={recoveryKeySet} />
        {recoveryOverlay}
      </>
    );
  }

  return (
    <>
      {children}
      {recoveryOverlay}
    </>
  );
}
