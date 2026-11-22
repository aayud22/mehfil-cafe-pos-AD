'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { loginSchema, LoginInput } from '@/schemas/login';
import { loginAction } from '@/app/actions/auth';
import { toast } from 'sonner';

import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Coffee, ShieldCheck, ChefHat, Receipt, Smartphone, Loader2 } from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  });

  const onSubmit = async (values: LoginInput) => {
    setIsSubmitting(true);
    try {
      const res = await loginAction(values);
      if (res?.error) {
        toast.error('Login Failed', { description: res.error });
        setIsSubmitting(false);
        return;
      }

      toast.success('Welcome back to Mehfil Cafe POS!');
      router.push(res.redirectTo || '/');
      router.refresh();
    } catch {
      toast.error('An unexpected error occurred during sign in.');
      setIsSubmitting(false);
    }
  };

  const handleQuickFill = (email: string) => {
    form.setValue('email', email);
    form.setValue('password', 'demo1234');
    form.clearErrors();
  };

  return (
    <div className="flex min-h-dvh w-full items-center justify-center p-4 bg-gradient-to-br from-background via-card to-background">
      <Card className="w-full max-w-md border-border/80 shadow-2xl backdrop-blur">
        <CardHeader className="text-center pb-4">
          <div className="mx-auto mb-2 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/20 text-primary ring-1 ring-primary/30">
            <Coffee className="h-8 w-8" />
          </div>
          <CardTitle className="text-2xl font-bold tracking-tight text-foreground">
            Mehfil Cafe
          </CardTitle>
          <CardDescription className="text-xs sm:text-sm text-muted-foreground">
            Point-of-Sale & Operations Management System
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-6">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">
                      Email Address
                    </FormLabel>
                    <FormControl>
                      <Input
                        type="email"
                        placeholder="e.g. owner@mehfilcafe.demo"
                        autoComplete="email"
                        className="h-11 text-base md:text-sm"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">
                      Password
                    </FormLabel>
                    <FormControl>
                      <Input
                        type="password"
                        placeholder="••••••••"
                        autoComplete="current-password"
                        className="h-11 text-base md:text-sm"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <Button
                type="submit"
                disabled={isSubmitting}
                className="w-full h-11 text-base font-semibold shadow-lg"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Authenticating...
                  </>
                ) : (
                  'Sign In to Mehfil POS'
                )}
              </Button>
            </form>
          </Form>

          <div className="border-t border-border pt-4">
            <p className="mb-3 text-center text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Demo Logins (Click to autofill)
            </p>
            <div className="grid grid-cols-2 gap-2">
              <Button
                type="button"
                variant="outline"
                className="h-11 justify-start gap-2 text-xs font-medium"
                onClick={() => handleQuickFill('owner@mehfilcafe.demo')}
              >
                <ShieldCheck className="h-4 w-4 text-amber-500 shrink-0" />
                <span className="truncate">Owner</span>
              </Button>

              <Button
                type="button"
                variant="outline"
                className="h-11 justify-start gap-2 text-xs font-medium"
                onClick={() => handleQuickFill('kitchen@mehfilcafe.demo')}
              >
                <ChefHat className="h-4 w-4 text-emerald-500 shrink-0" />
                <span className="truncate">Kitchen</span>
              </Button>

              <Button
                type="button"
                variant="outline"
                className="h-11 justify-start gap-2 text-xs font-medium"
                onClick={() => handleQuickFill('cashier@mehfilcafe.demo')}
              >
                <Receipt className="h-4 w-4 text-blue-500 shrink-0" />
                <span className="truncate">Cashier</span>
              </Button>

              <Button
                type="button"
                variant="outline"
                className="h-11 justify-start gap-2 text-xs font-medium"
                onClick={() => handleQuickFill('waiter@mehfilcafe.demo')}
              >
                <Smartphone className="h-4 w-4 text-purple-500 shrink-0" />
                <span className="truncate">Waiter</span>
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
