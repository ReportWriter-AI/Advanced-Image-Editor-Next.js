"use client";

import { useEffect, useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { 
  Facebook, 
  Twitter, 
  Youtube, 
  Linkedin, 
  Instagram,
  Info,
  Globe
} from 'lucide-react';
import { toast } from 'sonner';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

const socialLinksSchema = z.object({
  facebookUrl: z
    .string()
    .url('Please enter a valid URL')
    .or(z.literal(''))
    .optional(),
  twitterUrl: z
    .string()
    .url('Please enter a valid URL')
    .or(z.literal(''))
    .optional(),
  youtubeUrl: z
    .string()
    .url('Please enter a valid URL')
    .or(z.literal(''))
    .optional(),
  googlePlusUrl: z
    .string()
    .url('Please enter a valid URL')
    .or(z.literal(''))
    .optional(),
  linkedinUrl: z
    .string()
    .url('Please enter a valid URL')
    .or(z.literal(''))
    .optional(),
  instagramUrl: z
    .string()
    .url('Please enter a valid URL')
    .or(z.literal(''))
    .optional(),
  yelpUrl: z
    .string()
    .url('Please enter a valid URL')
    .or(z.literal(''))
    .optional(),
});

type SocialLinksFormValues = z.infer<typeof socialLinksSchema>;

// Custom icons for platforms not in lucide-react
const GooglePlusIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="currentColor"
    className="h-5 w-5"
  >
    <path d="M7.635 10.909v2.619h4.335c-.173 1.125-1.31 3.295-4.331 3.295-2.604 0-4.731-2.16-4.731-4.823 0-2.662 2.122-4.822 4.728-4.822 1.485 0 2.533.633 3.112 1.178l2.133-2.052C9.149 2.216 7.635 1.5 5.645 1.5 2.469 1.5 0 4.115 0 7.5c0 3.378 2.469 6 5.645 6 3.469 0 5.755-2.445 5.755-5.89 0-.4-.044-.785-.133-1.101H7.635zm16.365 0h-2.183V8.772h-2.183v2.137H17.636v2.136h2.182v2.138h2.183v-2.138h2.182v-2.136z" />
  </svg>
);

const YelpIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 32 32"
    fill="currentColor"
    className="h-5 w-5"
  >
    <path d="M13.961 22.279c0.246-0.273 0.601-0.444 0.995-0.444 0.739 0 1.338 0.599 1.338 1.338 0 0.016-0 0.032-0.001 0.048l0-0.002-0.237 6.483c-0.027 0.719-0.616 1.293-1.34 1.293-0.077 0-0.153-0.006-0.226-0.019l0.008 0.001c-1.763-0.303-3.331-0.962-4.69-1.902l0.039 0.025c-0.351-0.245-0.578-0.647-0.578-1.102 0-0.346 0.131-0.661 0.346-0.898l-0.001 0.001 4.345-4.829zM12.853 20.434l-6.301 1.572c-0.097 0.025-0.208 0.039-0.322 0.039-0.687 0-1.253-0.517-1.332-1.183l-0.001-0.006c-0.046-0.389-0.073-0.839-0.073-1.295 0-1.324 0.223-2.597 0.635-3.781l-0.024 0.081c0.183-0.534 0.681-0.911 1.267-0.911 0.214 0 0.417 0.050 0.596 0.14l-0.008-0.004 5.833 2.848c0.45 0.221 0.754 0.677 0.754 1.203 0 0.623-0.427 1.147-1.004 1.294l-0.009 0.002zM13.924 15.223l-6.104-10.574c-0.112-0.191-0.178-0.421-0.178-0.667 0-0.529 0.307-0.987 0.752-1.204l0.008-0.003c1.918-0.938 4.153-1.568 6.511-1.761l0.067-0.004c0.031-0.003 0.067-0.004 0.104-0.004 0.738 0 1.337 0.599 1.337 1.337 0 0.001 0 0.001 0 0.002v-0 12.207c-0 0.739-0.599 1.338-1.338 1.338-0.493 0-0.923-0.266-1.155-0.663l-0.003-0.006zM19.918 20.681l6.176 2.007c0.541 0.18 0.925 0.682 0.925 1.274 0 0.209-0.048 0.407-0.134 0.584l0.003-0.008c-0.758 1.569-1.799 2.889-3.068 3.945l-0.019 0.015c-0.23 0.19-0.527 0.306-0.852 0.306-0.477 0-0.896-0.249-1.134-0.625l-0.003-0.006-3.449-5.51c-0.128-0.201-0.203-0.446-0.203-0.709 0-0.738 0.598-1.336 1.336-1.336 0.147 0 0.289 0.024 0.421 0.068l-0.009-0.003zM26.197 16.742l-6.242 1.791c-0.11 0.033-0.237 0.052-0.368 0.052-0.737 0-1.335-0.598-1.335-1.335 0-0.282 0.087-0.543 0.236-0.758l-0.003 0.004 3.63-5.383c0.244-0.358 0.65-0.59 1.111-0.59 0.339 0 0.649 0.126 0.885 0.334l-0.001-0.001c1.25 1.104 2.25 2.459 2.925 3.99l0.029 0.073c0.070 0.158 0.111 0.342 0.111 0.535 0 0.608-0.405 1.121-0.959 1.286l-0.009 0.002z"></path>
  </svg>
);

const socialPlatforms = [
  {
    name: 'facebookUrl',
    label: 'Facebook',
    placeholder: 'https://www.facebook.com/yourpage',
    icon: Facebook,
    color: 'text-blue-600',
  },
  {
    name: 'twitterUrl',
    label: 'Twitter',
    placeholder: 'https://twitter.com/yourhandle',
    icon: Twitter,
    color: 'text-sky-500',
  },
  {
    name: 'youtubeUrl',
    label: 'YouTube',
    placeholder: 'https://www.youtube.com/channel/yourchannel',
    icon: Youtube,
    color: 'text-red-600',
  },
  {
    name: 'googlePlusUrl',
    label: 'Google Plus',
    placeholder: 'https://plus.google.com/yourpage',
    icon: GooglePlusIcon,
    color: 'text-red-500',
  },
  {
    name: 'linkedinUrl',
    label: 'LinkedIn',
    placeholder: 'https://www.linkedin.com/company/yourcompany',
    icon: Linkedin,
    color: 'text-blue-700',
  },
  {
    name: 'instagramUrl',
    label: 'Instagram',
    placeholder: 'https://www.instagram.com/yourhandle',
    icon: Instagram,
    color: 'text-pink-600',
  },
  {
    name: 'yelpUrl',
    label: 'Yelp',
    placeholder: 'https://www.yelp.com/biz/yourbusiness',
    icon: YelpIcon,
    color: 'text-red-600',
  },
];

export default function SocialLinksPage() {
  const [initialLoading, setInitialLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const form = useForm<SocialLinksFormValues>({
    resolver: zodResolver(socialLinksSchema),
    defaultValues: {
      facebookUrl: '',
      twitterUrl: '',
      youtubeUrl: '',
      googlePlusUrl: '',
      linkedinUrl: '',
      instagramUrl: '',
      yelpUrl: '',
    },
  });

  const {
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = form;

  useEffect(() => {
    const loadSocialLinks = async () => {
      try {
        setInitialLoading(true);
        const response = await fetch('/api/social-links', {
          credentials: 'include',
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.error || 'Failed to load social links');
        }

        const data = await response.json();

        reset({
          facebookUrl: data.socialLinks?.facebookUrl || '',
          twitterUrl: data.socialLinks?.twitterUrl || '',
          youtubeUrl: data.socialLinks?.youtubeUrl || '',
          googlePlusUrl: data.socialLinks?.googlePlusUrl || '',
          linkedinUrl: data.socialLinks?.linkedinUrl || '',
          instagramUrl: data.socialLinks?.instagramUrl || '',
          yelpUrl: data.socialLinks?.yelpUrl || '',
        });
      } catch (error: any) {
        console.error(error);
        toast.error(error.message || 'Unable to load social links');
      } finally {
        setInitialLoading(false);
      }
    };

    loadSocialLinks();
  }, [reset]);

  const onSubmit = async (values: SocialLinksFormValues) => {
    try {
      setSaving(true);
      const response = await fetch('/api/social-links', {
        method: 'PUT',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          socialLinks: {
            facebookUrl: values.facebookUrl,
            twitterUrl: values.twitterUrl,
            youtubeUrl: values.youtubeUrl,
            googlePlusUrl: values.googlePlusUrl,
            linkedinUrl: values.linkedinUrl,
            instagramUrl: values.instagramUrl,
            yelpUrl: values.yelpUrl,
          },
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to save social links');
      }

      const data = await response.json();

      reset({
        facebookUrl: data.socialLinks?.facebookUrl || '',
        twitterUrl: data.socialLinks?.twitterUrl || '',
        youtubeUrl: data.socialLinks?.youtubeUrl || '',
        googlePlusUrl: data.socialLinks?.googlePlusUrl || '',
        linkedinUrl: data.socialLinks?.linkedinUrl || '',
        instagramUrl: data.socialLinks?.instagramUrl || '',
        yelpUrl: data.socialLinks?.yelpUrl || '',
      });

      toast.success('Social links updated successfully');
    } catch (error: any) {
      console.error(error);
      toast.error(error.message || 'Unable to save social links');
    } finally {
      setSaving(false);
    }
  };

  const renderTooltipLabel = (label: string, tooltip?: string, htmlFor?: string) => (
    <div className="flex items-center gap-2">
      <Label htmlFor={htmlFor}>{label}</Label>
      {tooltip ? (
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              className="text-muted-foreground hover:text-foreground"
              aria-label={tooltip}
            >
              <Info className="h-4 w-4" />
            </button>
          </TooltipTrigger>
          <TooltipContent className="max-w-xs text-left">
            {tooltip}
          </TooltipContent>
        </Tooltip>
      ) : null}
    </div>
  );

  return (
    <TooltipProvider>
      <div className="space-y-6">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Social Links</h2>
          <p className="text-muted-foreground">
            Add your company's social media profiles to help customers find you online
          </p>
        </div>

        {initialLoading ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              Loading social links...
            </CardContent>
          </Card>
        ) : (
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Social Media Profiles</CardTitle>
                <CardDescription>
                  Enter the full URLs for your social media profiles. These will be displayed on your public profile.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {socialPlatforms.map((platform) => {
                  const IconComponent = platform.icon;
                  const fieldName = platform.name as keyof SocialLinksFormValues;
                  const error = errors[fieldName];

                  return (
                    <div key={platform.name} className="space-y-2">
                      <div className="flex items-center gap-3">
                        <div className={`${platform.color} flex-shrink-0`}>
                          <IconComponent />
                        </div>
                        {renderTooltipLabel(
                          platform.label,
                          `Enter your ${platform.label} profile URL`,
                          platform.name
                        )}
                      </div>
                      <Controller
                        name={fieldName}
                        control={control}
                        render={({ field }) => (
                          <div className="relative">
                            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                              <Globe className="h-4 w-4" />
                            </div>
                            <Input
                              id={platform.name}
                              type="url"
                              placeholder={platform.placeholder}
                              className="pl-10"
                              {...field}
                            />
                          </div>
                        )}
                      />
                      {error && (
                        <p className="text-sm text-destructive">{error.message}</p>
                      )}
                    </div>
                  );
                })}
              </CardContent>
            </Card>

            <div className="flex justify-end">
              <Button type="submit" disabled={saving}>
                {saving ? 'Saving...' : 'Save Changes'}
              </Button>
            </div>
          </form>
        )}
      </div>
    </TooltipProvider>
  );
}

