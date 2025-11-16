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
    viewBox="0 0 24 24"
    fill="currentColor"
    className="h-5 w-5"
  >
    <path d="M20.16 12.594l-4.995 1.433c-.96.276-1.74-.8-1.49-1.732l2.138-8.042c.25-.932 1.49-1.415 2.207-.726l3.255 3.256c.532.533.207 1.39-.505 1.39l-1.79-.02c-.96 0-1.35 1.1-.71 1.84l1.8 1.81c.64.74.17 1.84-.71 1.84l-1.69-.01zm-8.854-7.78l-1.677 8.11c-.2.97-1.4 1.4-2.05.75l-2.98-2.98c-.65-.65-1.4-.2-1.4.75v7.36c0 .95 1.4 1.4 2.05.75l11.29-11.3c.65-.64.2-2.05-.75-2.05h-7.36c-.95 0-1.4 1.4-.75 2.05l2.23 2.23c.64.65.17 1.85-.75 2.05l-1.68.34z" />
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

