"use client";

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '../../contexts/AuthContext';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import { Mail, Lock, User, Phone, ArrowRight, AlertCircle, CheckCircle2, Shield, Users, Award } from 'lucide-react';

// Zod Schemas for validation
const loginSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  rememberMe: z.boolean().optional().default(false),
});

const signupSchema = z.object({
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().min(1, 'Last name is required'),
  email: z.string().email('Please enter a valid email address'),
  phoneNumber: z.string().optional(),
  numberOfInspectors: z.string().optional().transform((val) => val === '' ? undefined : Number(val)),
  yearsOfExperience: z.string().optional().transform((val) => val === '' ? undefined : Number(val)),
  howDidYouHearAboutUs: z.string().optional(),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  agreedToTerms: z.boolean().refine((val) => val === true, {
    message: 'You must agree to the privacy policy and terms and conditions',
  }),
  smsOptIn: z.boolean().optional().default(false),
});

const forgotPasswordSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
});

const resendConfirmationSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
});

function LoginPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { login: authLogin, isAuthenticated, loading: authLoading } = useAuth();
  const [isSignup, setIsSignup] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [showResendConfirmation, setShowResendConfirmation] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  // Login form
  const loginForm = useForm({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: '',
      password: '',
      rememberMe: false,
    },
  });

  // Signup form
  const signupForm = useForm({
    resolver: zodResolver(signupSchema),
    defaultValues: {
      firstName: '',
      lastName: '',
      email: '',
      phoneNumber: '',
      numberOfInspectors: '',
      yearsOfExperience: '',
      howDidYouHearAboutUs: '',
      password: '',
      agreedToTerms: false,
      smsOptIn: false,
    },
  });

  // Forgot password form
  const forgotPasswordForm = useForm({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: {
      email: '',
    },
  });

  // Resend confirmation form
  const resendConfirmationForm = useForm({
    resolver: zodResolver(resendConfirmationSchema),
    defaultValues: {
      email: '',
    },
  });

  // Redirect authenticated users to home page (client-side fallback)
  useEffect(() => {
    if (!authLoading && isAuthenticated) {
      router.push('/');
    }
  }, [isAuthenticated, authLoading, router]);

  useEffect(() => {
    // Check for verification success
    if (searchParams.get('verified') === 'true') {
      setMessage({ type: 'success', text: 'Email verified successfully! You can now log in.' });
    }
    
    // Check for verification errors
    const error = searchParams.get('error');
    if (error === 'invalid_token') {
      setMessage({ type: 'error', text: 'Invalid verification token.' });
    } else if (error === 'invalid_or_expired_token') {
      setMessage({ type: 'error', text: 'This verification link has expired or is invalid.' });
    } else if (error === 'verification_failed') {
      setMessage({ type: 'error', text: 'Email verification failed. Please try again.' });
    }
  }, [searchParams]);

  const handleLogin = async (data: any) => {
    setLoading(true);
    setMessage(null);

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Login failed');
      }

      setMessage({ type: 'success', text: 'Login successful! Redirecting...' });
      authLogin(result.user);

      setTimeout(() => {
        router.push('/');
      }, 1000);

    } catch (error: any) {
      setMessage({ type: 'error', text: error.message });
    } finally {
      setLoading(false);
    }
  };

  const handleSignup = async (data: any) => {
    setLoading(true);
    setMessage(null);

    try {
      const response = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firstName: data.firstName,
          lastName: data.lastName,
          email: data.email,
          phoneNumber: data.phoneNumber || undefined,
          password: data.password,
          numberOfInspectors: data.numberOfInspectors,
          yearsOfExperience: data.yearsOfExperience,
          howDidYouHearAboutUs: data.howDidYouHearAboutUs || undefined,
          smsOptIn: data.smsOptIn,
          agreedToTerms: data.agreedToTerms
        })
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Signup failed');
      }

      setMessage({ type: 'success', text: 'Account created! Please check your email to verify your account.' });
      
      setTimeout(() => {
        signupForm.reset();
        setIsSignup(false);
      }, 2000);

    } catch (error: any) {
      setMessage({ type: 'error', text: error.message });
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async (data: any) => {
    setLoading(true);
    setMessage(null);

    try {
      const response = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to send reset email');
      }

      setMessage({ type: 'success', text: 'Password reset link sent to your email!' });
      
      setTimeout(() => {
        forgotPasswordForm.reset();
        setShowForgotPassword(false);
      }, 2000);

    } catch (error: any) {
      setMessage({ type: 'error', text: error.message });
    } finally {
      setLoading(false);
    }
  };

  const handleResendConfirmation = async (data: any) => {
    setLoading(true);
    setMessage(null);

    try {
      const response = await fetch('/api/auth/resend-confirmation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to resend confirmation');
      }

      setMessage({ type: 'success', text: 'Confirmation email sent! Please check your inbox.' });
      
      setTimeout(() => {
        resendConfirmationForm.reset();
        setShowResendConfirmation(false);
      }, 2000);

    } catch (error: any) {
      setMessage({ type: 'error', text: error.message });
    } finally {
      setLoading(false);
    }
  };

  // Show loading state while checking authentication
  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  // Don't render login page if authenticated (redirect will happen)
  if (isAuthenticated) {
    return null;
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 px-4 py-12 relative overflow-hidden">
      {/* Decorative background elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-blue-400 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-blob"></div>
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-indigo-400 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-blob animation-delay-2000"></div>
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-80 h-80 bg-purple-400 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-blob animation-delay-4000"></div>
      </div>

      <div className="max-w-md w-full relative z-10">
        {/* Logo/Header */}
        <div className="text-center mb-8 space-y-2">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-2xl mb-4 shadow-lg">
            <Shield className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-4xl font-bold bg-gradient-to-r from-gray-900 via-gray-800 to-gray-900 bg-clip-text text-transparent">
            ReportWriter AI
          </h1>
          <p className="text-gray-600 text-sm">Professional Inspection Reports</p>
        </div>

        {/* Main Card */}
        <Card className="shadow-2xl border-0 backdrop-blur-sm bg-white/90">
          <CardHeader className="space-y-4 pb-4">
            {/* Tab Switcher */}
            <div className="flex p-1 bg-muted rounded-lg">
              <Button
                type="button"
                variant={!isSignup ? "default" : "ghost"}
                className="flex-1 transition-all"
                onClick={() => {
                  setIsSignup(false);
                  setMessage(null);
                }}
              >
                <Lock className="w-4 h-4 mr-2" />
                Login
              </Button>
              <Button
                type="button"
                variant={isSignup ? "default" : "ghost"}
                className="flex-1 transition-all"
                onClick={() => {
                  setIsSignup(true);
                  setMessage(null);
                }}
              >
                <User className="w-4 h-4 mr-2" />
                Sign Up
              </Button>
            </div>

            {/* Message Display */}
            {message && (
              <div className={`flex items-start gap-3 p-4 rounded-lg border ${
                message.type === 'success' 
                  ? 'bg-green-50 text-green-800 border-green-200' 
                  : 'bg-red-50 text-red-800 border-red-200'
              }`}>
                {message.type === 'success' ? (
                  <CheckCircle2 className="w-5 h-5 flex-shrink-0 mt-0.5" />
                ) : (
                  <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                )}
                <p className="text-sm">{message.text}</p>
              </div>
            )}
          </CardHeader>

          <CardContent>
            {/* Login Form */}
            {!isSignup && (
              <form onSubmit={loginForm.handleSubmit(handleLogin)} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="login-email">Email Address</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="login-email"
                      type="email"
                      {...loginForm.register('email')}
                      placeholder="your@email.com"
                      className="pl-10 h-11"
                    />
                  </div>
                  {loginForm.formState.errors.email && (
                    <p className="text-sm text-red-600">{loginForm.formState.errors.email.message}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="login-password">Password</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="login-password"
                      type="password"
                      {...loginForm.register('password')}
                      placeholder="••••••••"
                      className="pl-10 h-11"
                    />
                  </div>
                  {loginForm.formState.errors.password && (
                    <p className="text-sm text-red-600">{loginForm.formState.errors.password.message}</p>
                  )}
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="remember"
                      checked={loginForm.watch('rememberMe')}
                      onCheckedChange={(checked) => loginForm.setValue('rememberMe', checked as boolean)}
                    />
                    <Label htmlFor="remember" className="text-sm font-normal cursor-pointer">
                      Remember me
                    </Label>
                  </div>

                  <Button
                    type="button"
                    variant="link"
                    className="px-0 h-auto"
                    onClick={() => setShowForgotPassword(true)}
                  >
                    Forgot password?
                  </Button>
                </div>

                <Button
                  type="submit"
                  disabled={loading}
                  className="w-full h-11 gap-2"
                  size="lg"
                >
                  {loading ? 'Logging in...' : (
                    <>
                      Login
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </Button>

                <Separator className="my-4" />

                <Button
                  type="button"
                  variant="outline"
                  className="w-full"
                  onClick={() => setShowResendConfirmation(true)}
                >
                  Resend confirmation email
                </Button>
              </form>
            )}

            {/* Signup Form */}
            {isSignup && (
              <form onSubmit={signupForm.handleSubmit(handleSignup)} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="firstName">First Name</Label>
                    <Input
                      id="firstName"
                      type="text"
                      {...signupForm.register('firstName')}
                      placeholder="John"
                      className="h-11"
                    />
                    {signupForm.formState.errors.firstName && (
                      <p className="text-sm text-red-600">{signupForm.formState.errors.firstName.message}</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="lastName">Last Name</Label>
                    <Input
                      id="lastName"
                      type="text"
                      {...signupForm.register('lastName')}
                      placeholder="Doe"
                      className="h-11"
                    />
                    {signupForm.formState.errors.lastName && (
                      <p className="text-sm text-red-600">{signupForm.formState.errors.lastName.message}</p>
                    )}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="signup-email">Email Address</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="signup-email"
                      type="email"
                      {...signupForm.register('email')}
                      placeholder="your@email.com"
                      className="pl-10 h-11"
                    />
                  </div>
                  {signupForm.formState.errors.email && (
                    <p className="text-sm text-red-600">{signupForm.formState.errors.email.message}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="phoneNumber">Phone Number</Label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="phoneNumber"
                      type="tel"
                      {...signupForm.register('phoneNumber')}
                      placeholder="+1 (555) 000-0000"
                      className="pl-10 h-11"
                    />
                  </div>
                  {signupForm.formState.errors.phoneNumber && (
                    <p className="text-sm text-red-600">{signupForm.formState.errors.phoneNumber.message}</p>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="numberOfInspectors">Number of Inspectors</Label>
                    <div className="relative">
                      <Users className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="numberOfInspectors"
                        type="number"
                        min="1"
                        {...signupForm.register('numberOfInspectors')}
                        placeholder="1"
                        className="pl-10 h-11"
                      />
                    </div>
                    {signupForm.formState.errors.numberOfInspectors && (
                      <p className="text-sm text-red-600">{signupForm.formState.errors.numberOfInspectors.message}</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="yearsOfExperience">Years of Experience</Label>
                    <div className="relative">
                      <Award className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="yearsOfExperience"
                        type="number"
                        min="0"
                        {...signupForm.register('yearsOfExperience')}
                        placeholder="0"
                        className="pl-10 h-11"
                      />
                    </div>
                    {signupForm.formState.errors.yearsOfExperience && (
                      <p className="text-sm text-red-600">{signupForm.formState.errors.yearsOfExperience.message}</p>
                    )}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="howDidYouHearAboutUs">How did you hear about us?</Label>
                  <Textarea
                    id="howDidYouHearAboutUs"
                    {...signupForm.register('howDidYouHearAboutUs')}
                    placeholder="Tell us how you found ReportWriter AI..."
                    rows={3}
                    className="resize-none"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="signup-password">Password</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="signup-password"
                      type="password"
                      {...signupForm.register('password')}
                      placeholder="••••••••"
                      className="pl-10 h-11"
                    />
                  </div>
                  {signupForm.formState.errors.password && (
                    <p className="text-sm text-red-600">{signupForm.formState.errors.password.message}</p>
                  )}
                  <p className="text-xs text-muted-foreground">Minimum 6 characters</p>
                </div>

                <div className="space-y-3">
                  <div className="flex items-start space-x-2">
                    <Checkbox
                      id="agreedToTerms"
                      checked={signupForm.watch('agreedToTerms')}
                      onCheckedChange={(checked) => signupForm.setValue('agreedToTerms', checked as boolean)}
                    />
                    <Label htmlFor="agreedToTerms" className="text-sm font-normal cursor-pointer leading-relaxed">
                      I agree to the{' '}
                      <a href="/privacy-policy" target="_blank" className="text-primary hover:underline font-medium">
                        Privacy Policy
                      </a>
                      {' '}and{' '}
                      <a href="/terms-and-conditions" target="_blank" className="text-primary hover:underline font-medium">
                        Terms and Conditions
                      </a>
                      {' '}*
                    </Label>
                  </div>
                  {signupForm.formState.errors.agreedToTerms && (
                    <p className="text-sm text-red-600">{signupForm.formState.errors.agreedToTerms.message}</p>
                  )}

                  <div className="flex items-start space-x-2">
                    <Checkbox
                      id="smsOptIn"
                      checked={signupForm.watch('smsOptIn')}
                      onCheckedChange={(checked) => signupForm.setValue('smsOptIn', checked as boolean)}
                    />
                    <Label htmlFor="smsOptIn" className="text-sm font-normal cursor-pointer leading-relaxed">
                      Yes, I'd like to receive updates via text/SMS from ReportWriter AI
                    </Label>
                  </div>
                </div>

                <Button
                  type="submit"
                  disabled={loading}
                  className="w-full h-11 gap-2"
                  size="lg"
                >
                  {loading ? 'Creating Account...' : (
                    <>
                      Create Account
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </Button>
              </form>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Forgot Password Modal */}
      {showForgotPassword && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
          <Card className="max-w-md w-full shadow-2xl border-0 animate-in zoom-in-95 duration-200">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Lock className="w-5 h-5" />
                Reset Password
              </CardTitle>
              <CardDescription>
                Enter your email address and we'll send you a link to reset your password.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {message && (
                <div className={`flex items-start gap-3 p-4 rounded-lg border mb-4 ${
                  message.type === 'success' 
                    ? 'bg-green-50 text-green-800 border-green-200' 
                    : 'bg-red-50 text-red-800 border-red-200'
                }`}>
                  {message.type === 'success' ? (
                    <CheckCircle2 className="w-5 h-5 flex-shrink-0 mt-0.5" />
                  ) : (
                    <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                  )}
                  <p className="text-sm">{message.text}</p>
                </div>
              )}

              <form onSubmit={forgotPasswordForm.handleSubmit(handleForgotPassword)} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="forgot-email">Email Address</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="forgot-email"
                      type="email"
                      {...forgotPasswordForm.register('email')}
                      placeholder="your@email.com"
                      className="pl-10 h-11"
                    />
                  </div>
                  {forgotPasswordForm.formState.errors.email && (
                    <p className="text-sm text-red-600">{forgotPasswordForm.formState.errors.email.message}</p>
                  )}
                </div>

                <div className="flex gap-3 pt-2">
                  <Button
                    type="button"
                    variant="outline"
                    className="flex-1"
                    onClick={() => {
                      setShowForgotPassword(false);
                      setMessage(null);
                      forgotPasswordForm.reset();
                    }}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={loading}
                    className="flex-1 gap-2"
                  >
                    {loading ? 'Sending...' : (
                      <>
                        Send Link
                        <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Resend Confirmation Modal */}
      {showResendConfirmation && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
          <Card className="max-w-md w-full shadow-2xl border-0 animate-in zoom-in-95 duration-200">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Mail className="w-5 h-5" />
                Resend Confirmation Email
              </CardTitle>
              <CardDescription>
                Enter your email address and we'll send you a new confirmation link.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {message && (
                <div className={`flex items-start gap-3 p-4 rounded-lg border mb-4 ${
                  message.type === 'success' 
                    ? 'bg-green-50 text-green-800 border-green-200' 
                    : 'bg-red-50 text-red-800 border-red-200'
                }`}>
                  {message.type === 'success' ? (
                    <CheckCircle2 className="w-5 h-5 flex-shrink-0 mt-0.5" />
                  ) : (
                    <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                  )}
                  <p className="text-sm">{message.text}</p>
                </div>
              )}

              <form onSubmit={resendConfirmationForm.handleSubmit(handleResendConfirmation)} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="resend-email">Email Address</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="resend-email"
                      type="email"
                      {...resendConfirmationForm.register('email')}
                      placeholder="your@email.com"
                      className="pl-10 h-11"
                    />
                  </div>
                  {resendConfirmationForm.formState.errors.email && (
                    <p className="text-sm text-red-600">{resendConfirmationForm.formState.errors.email.message}</p>
                  )}
                </div>

                <div className="flex gap-3 pt-2">
                  <Button
                    type="button"
                    variant="outline"
                    className="flex-1"
                    onClick={() => {
                      setShowResendConfirmation(false);
                      setMessage(null);
                      resendConfirmationForm.reset();
                    }}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={loading}
                    className="flex-1 gap-2"
                  >
                    {loading ? 'Sending...' : (
                      <>
                        Resend Email
                        <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center">Loading...</div>}>
      <LoginPageContent />
    </Suspense>
  );
}
