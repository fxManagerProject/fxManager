import { Button } from '@/components/ui/button';
import { Field, FieldGroup, FieldLabel, FieldSeparator } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Server } from 'lucide-react';
import { useState } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { Separator } from '@/components/ui/separator';

export default function SetupPage() {
  const { setup } = useAuth();
  const [formData, setData] = useState<{ username: string; password: string }>({
    username: '',
    password: '',
  });
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(e: React.SubmitEvent<HTMLFormElement>) {
    e.preventDefault();
    setup(formData.username, formData.password).catch((err) => setError((err as Error).message));
  }

  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-6 bg-background p-6 md:p-10">
      <div className="w-full max-w-sm flex flex-col gap-6">
        <form onSubmit={(e) => handleSubmit(e)}>
          <FieldGroup>
            <div className="flex flex-col items-center gap-2 text-center">
              <div className="flex flex-col items-center gap-2 font-medium group">
                <div className="relative flex size-10 items-center justify-center rounded-xl">
                  <div className="absolute inset-0 rounded-xl bg-primary/50 blur-md" />

                  <Server className="size-6 text-primary-foreground z-10" />
                </div>
                <span className="sr-only">Fx Manager</span>
              </div>
              <h1 className="text-xl font-bold mt-5">
                <span className="text-primary">fx</span>Manager WebPanel
              </h1>
              <Separator className="my-2" />
              <p className="italic text-muted-foreground">
                The webpanel is not yet configured, please setup the initial master account.
              </p>
            </div>

            <FieldSeparator />

            <Field>
              <FieldLabel htmlFor="username">Username</FieldLabel>
              <Input
                id="username"
                type="text"
                placeholder="john_doe"
                value={formData.username}
                onChange={(e) => setData((prev) => ({ ...prev, username: e.target.value }))}
                required
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="password">Password</FieldLabel>
              <Input
                id="password"
                type="password"
                placeholder="password"
                value={formData.password}
                onChange={(e) => setData((prev) => ({ ...prev, password: e.target.value }))}
                required
              />
            </Field>
            <Field>
              <Button type="submit">Configure</Button>
            </Field>
          </FieldGroup>
        </form>
        <span className="text-red-500 text-center">{error}</span>
      </div>
    </div>
  );
}
