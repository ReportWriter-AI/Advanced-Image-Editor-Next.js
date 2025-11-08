"use client";

import { useEffect, useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Country, State } from 'country-state-city';
import { Check, Info } from 'lucide-react';
import { toast } from 'sonner';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { ImageUpload } from '@/components/ui/image-upload';

import { useAuth } from '../../../contexts/AuthContext';

import 'react-quill-new/dist/quill.snow.css';

const ReactQuill = dynamic(() => import('react-quill-new'), { ssr: false });

const profileSchema = z.object({
  companyName: z.string().min(1, 'Company name is required'),
  address: z.string().optional(),
  country: z.string().optional(),
  state: z.string().optional(),
  city: z.string().optional(),
  zip: z.string().optional(),
  displayAddressPublicly: z.boolean(),
  phone: z.string().optional(),
  website: z
    .string()
    .url('Please enter a valid URL')
    .or(z.literal(''))
    .optional(),
  email: z
    .string()
    .email('Please enter a valid email address')
    .or(z.literal(''))
    .optional(),
  description: z.string().optional(),
  videoUrl: z
    .string()
    .url('Please enter a valid YouTube URL')
    .or(z.literal(''))
    .optional(),
  serviceOffered: z.string().optional(),
  serviceArea: z.string().optional(),
  companyLogo: z.string().optional(),
  companyHeaderLogo: z.string().optional(),
  inspectorFirstName: z.string().min(1, 'First name is required'),
  inspectorLastName: z.string().min(1, 'Last name is required'),
  inspectorPhone: z.string().optional(),
  inspectorCredentials: z.string().optional(),
  inspectorProfileImage: z.string().optional(),
});

type ProfileFormValues = z.infer<typeof profileSchema>;

interface ProfileUser {
  email: string;
}

export default function ProfilePage() {
  const { user: authUser } = useAuth();
  const [profileUser, setProfileUser] = useState<ProfileUser | null>(null);
  const [initialLoading, setInitialLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const form = useForm<ProfileFormValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      companyName: '',
      address: '',
      country: '',
      state: '',
      city: '',
      zip: '',
      displayAddressPublicly: false,
      phone: '',
      website: '',
      email: '',
      description: '',
      videoUrl: '',
      serviceOffered: '',
      serviceArea: '',
      companyLogo: '',
      companyHeaderLogo: '',
      inspectorFirstName: '',
      inspectorLastName: '',
      inspectorPhone: '',
      inspectorCredentials: '',
      inspectorProfileImage: '',
    },
  });

  const {
    control,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = form;

  const selectedCountry = watch('country');
  const selectedState = watch('state');

  const countryOptions = useMemo(() => Country.getAllCountries(), []);
  const stateOptions = useMemo(
    () => (selectedCountry ? State.getStatesOfCountry(selectedCountry) : []),
    [selectedCountry]
  );

  const [countryOpen, setCountryOpen] = useState(false);
  const [stateOpen, setStateOpen] = useState(false);

  const selectedCountryLabel = useMemo(() => {
    if (!selectedCountry) return '';
    const match = countryOptions.find((country) => country.isoCode === selectedCountry);
    return match ? match.name : selectedCountry;
  }, [countryOptions, selectedCountry]);

  const selectedStateLabel = useMemo(() => {
    if (!selectedState) return '';
    const match = stateOptions.find((state) => state.isoCode === selectedState);
    return match ? match.name : selectedState;
  }, [selectedState, stateOptions]);

  const stateDisabled = !selectedCountry || stateOptions.length === 0;

  useEffect(() => {
    if (stateDisabled && stateOpen) {
      setStateOpen(false);
    }
  }, [stateDisabled, stateOpen]);

  const quillModules = useMemo(
    () => ({
      toolbar: [
        [{ header: [1, 2, 3, false] }],
        ['bold', 'italic', 'underline', 'strike'],
        [{ list: 'ordered' }, { list: 'bullet' }],
        ['link'],
        ['clean'],
      ],
    }),
    []
  );

  useEffect(() => {
    const loadProfile = async () => {
      try {
        setInitialLoading(true);
        const response = await fetch('/api/profile', {
          credentials: 'include',
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.error || 'Failed to load profile data');
        }

        const data = await response.json();

        reset({
          companyName: data.company?.name || '',
          address: data.company?.address || '',
          country: data.company?.country || '',
          state: data.company?.state || '',
          city: data.company?.city || '',
          zip: data.company?.zip || '',
          displayAddressPublicly: data.company?.displayAddressPublicly ?? false,
          phone: data.company?.phone || '',
          website: data.company?.website || '',
          email: data.company?.email || '',
          description: data.company?.description || '',
          videoUrl: data.company?.videoUrl || '',
          serviceOffered: data.company?.serviceOffered || '',
          serviceArea: data.company?.serviceArea || '',
          companyLogo: data.company?.logoUrl || '',
          companyHeaderLogo: data.company?.headerLogoUrl || '',
          inspectorFirstName: data.user?.firstName || '',
          inspectorLastName: data.user?.lastName || '',
          inspectorPhone: data.user?.phoneNumber || '',
          inspectorCredentials: data.user?.credentials || '',
          inspectorProfileImage: data.user?.profileImageUrl || '',
        });

        setProfileUser({
          email: data.user?.email || authUser?.email || '',
        });
      } catch (error: any) {
        console.error(error);
        toast.error(error.message || 'Unable to load profile');
      } finally {
        setInitialLoading(false);
      }
    };

    loadProfile();
  }, [authUser?.email, reset]);

  const onSubmit = async (values: ProfileFormValues) => {
    try {
      setSaving(true);
      const response = await fetch('/api/profile', {
        method: 'PUT',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          company: {
            name: values.companyName,
            address: values.address,
            country: values.country,
            state: values.state,
            city: values.city,
            zip: values.zip,
            displayAddressPublicly: values.displayAddressPublicly,
            phone: values.phone,
            website: values.website,
            email: values.email,
            description: values.description,
            videoUrl: values.videoUrl,
            serviceOffered: values.serviceOffered,
            serviceArea: values.serviceArea,
            logoUrl: values.companyLogo,
            headerLogoUrl: values.companyHeaderLogo,
          },
          inspector: {
            firstName: values.inspectorFirstName,
            lastName: values.inspectorLastName,
            phoneNumber: values.inspectorPhone,
            credentials: values.inspectorCredentials,
            profileImageUrl: values.inspectorProfileImage,
          },
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to save profile');
      }

      const data = await response.json();

      reset({
        companyName: data.company?.name || '',
        address: data.company?.address || '',
        country: data.company?.country || '',
        state: data.company?.state || '',
        city: data.company?.city || '',
        zip: data.company?.zip || '',
        displayAddressPublicly: data.company?.displayAddressPublicly ?? false,
        phone: data.company?.phone || '',
        website: data.company?.website || '',
        email: data.company?.email || '',
        description: data.company?.description || '',
        videoUrl: data.company?.videoUrl || '',
        serviceOffered: data.company?.serviceOffered || '',
        serviceArea: data.company?.serviceArea || '',
        companyLogo: data.company?.logoUrl || '',
        companyHeaderLogo: data.company?.headerLogoUrl || '',
        inspectorFirstName: data.user?.firstName || '',
        inspectorLastName: data.user?.lastName || '',
        inspectorPhone: data.user?.phoneNumber || '',
        inspectorCredentials: data.user?.credentials || '',
        inspectorProfileImage: data.user?.profileImageUrl || '',
      });

      setProfileUser({
        email: data.user?.email || profileUser?.email || '',
      });

      toast.success('Profile updated successfully');
    } catch (error: any) {
      console.error(error);
      toast.error(error.message || 'Unable to save profile');
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
          <h2 className="text-3xl font-bold tracking-tight">Profile</h2>
          <p className="text-muted-foreground">Manage your company and inspector information</p>
        </div>

        {initialLoading ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              Loading profile...
            </CardContent>
          </Card>
        ) : (
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
              <Card>
                <CardHeader>
                  <CardTitle>Company Information</CardTitle>
                  <CardDescription>
                    These details appear on your public profile and marketing materials
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="grid gap-6 md:grid-cols-2">
                    <Controller
                      name="companyLogo"
                      control={control}
                      render={({ field }) => (
                        <ImageUpload
                          label="Company Logo"
                          description="Shown in communications and public listings"
                          shape="square"
                          value={field.value || ''}
                          onChange={(url) => field.onChange(url ?? '')}
                          imageClassName="h-24 w-24"
                        />
                      )}
                    />
                    <Controller
                      name="companyHeaderLogo"
                      control={control}
                      render={({ field }) => (
                        <ImageUpload
                          label="Header Logo"
                          description="Displayed on reports and branded documents"
                          shape="square"
                          value={field.value || ''}
                          onChange={(url) => field.onChange(url ?? '')}
                          imageClassName="h-24 w-40"
                        />
                      )}
                    />
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      {renderTooltipLabel('Name', 'Your company name', 'companyName')}
                      <Controller
                        name="companyName"
                        control={control}
                        render={({ field }) => (
                          <Input id="companyName" placeholder="Acme Inspections" {...field} />
                        )}
                      />
                      {errors.companyName && (
                        <p className="text-sm text-destructive">{errors.companyName.message}</p>
                      )}
                    </div>
                    <div className="space-y-2">
                      {renderTooltipLabel('Phone', 'Let potential customers know the best number to reach you at.', 'phone')}
                      <Controller
                        name="phone"
                        control={control}
                        render={({ field }) => (
                          <Input id="phone" type="tel" placeholder="+1 (555) 123-4567" {...field} />
                        )}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    {renderTooltipLabel('Address', undefined, 'address')}
                    <Controller
                      name="address"
                      control={control}
                      render={({ field }) => (
                        <Input id="address" placeholder="123 Main Street" {...field} />
                      )}
                    />
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      {renderTooltipLabel('Country', undefined, 'country')}
                      <Controller
                        name="country"
                        control={control}
                        render={({ field }) => (
                          <Popover open={countryOpen} onOpenChange={setCountryOpen}>
                            <PopoverTrigger asChild>
                              <Button
                                type="button"
                                variant="outline"
                                role="combobox"
                                aria-expanded={countryOpen}
                                className="w-full justify-between"
                              >
                                {selectedCountryLabel ? (
                                  <span>{selectedCountryLabel}</span>
                                ) : (
                                  <span className="text-muted-foreground">Select a country</span>
                                )}
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-[320px] p-0" align="start">
                              <Command>
                                <CommandInput placeholder="Search country..." />
                                <CommandEmpty>No country found.</CommandEmpty>
                                <CommandList>
                                  <CommandGroup>
                                    {countryOptions.map((country) => (
                                      <CommandItem
                                        key={country.isoCode}
                                        value={country.name}
                                        onSelect={() => {
                                          field.onChange(country.isoCode);
                                          setValue('state', '', { shouldDirty: true });
                                          setCountryOpen(false);
                                        }}
                                      >
                                        {country.name}
                                        <Check
                                          className={`ml-auto h-4 w-4 ${
                                            selectedCountry === country.isoCode ? 'opacity-100' : 'opacity-0'
                                          }`}
                                        />
                                      </CommandItem>
                                    ))}
                                  </CommandGroup>
                                </CommandList>
                              </Command>
                            </PopoverContent>
                          </Popover>
                        )}
                      />
                      {errors.country && (
                        <p className="text-sm text-destructive">{errors.country.message}</p>
                      )}
                    </div>
                    <div className="space-y-2">
                      {renderTooltipLabel('State', undefined, 'state')}
                      <Controller
                        name="state"
                        control={control}
                        render={({ field }) => (
                          <Popover open={stateOpen && !stateDisabled} onOpenChange={setStateOpen}>
                            <PopoverTrigger asChild>
                              <Button
                                type="button"
                                variant="outline"
                                role="combobox"
                                aria-expanded={stateOpen && !stateDisabled}
                                className="w-full justify-between"
                                disabled={stateDisabled}
                              >
                                {selectedStateLabel ? (
                                  <span>{selectedStateLabel}</span>
                                ) : (
                                  <span className="text-muted-foreground">
                                    {!selectedCountry
                                      ? 'Select a country first'
                                      : 'Select a state'}
                                  </span>
                                )}
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-[320px] p-0" align="start">
                              <Command>
                                <CommandInput placeholder="Search state..." />
                                <CommandEmpty>
                                  {stateOptions.length === 0 ? 'No states available' : 'No state found.'}
                                </CommandEmpty>
                                <CommandList>
                                  <CommandGroup>
                                    {stateOptions.map((state) => (
                                      <CommandItem
                                        key={state.isoCode}
                                        value={state.name}
                                        onSelect={() => {
                                          field.onChange(state.isoCode);
                                          setStateOpen(false);
                                        }}
                                      >
                                        {state.name}
                                        <Check
                                          className={`ml-auto h-4 w-4 ${
                                            selectedState === state.isoCode ? 'opacity-100' : 'opacity-0'
                                          }`}
                                        />
                                      </CommandItem>
                                    ))}
                                  </CommandGroup>
                                </CommandList>
                              </Command>
                            </PopoverContent>
                          </Popover>
                        )}
                      />
                      {errors.state && (
                        <p className="text-sm text-destructive">{errors.state.message}</p>
                      )}
                    </div>
                  </div>

                  <div className="grid gap-4 md:grid-cols-3">
                    <div className="space-y-2">
                      {renderTooltipLabel('City', undefined, 'city')}
                      <Controller
                        name="city"
                        control={control}
                        render={({ field }) => (
                          <Input id="city" placeholder="Charlotte" {...field} />
                        )}
                      />
                    </div>
                    <div className="space-y-2">
                      {renderTooltipLabel('Zip', undefined, 'zip')}
                      <Controller
                        name="zip"
                        control={control}
                        render={({ field }) => (
                          <Input id="zip" placeholder="28202" {...field} />
                        )}
                      />
                    </div>
                    <div className="space-y-2">
                      {renderTooltipLabel(
                        'Display this address on your public profile?',
                        'If this is unchecked, only the city will show',
                        'displayAddressPublicly'
                      )}
                      <Controller
                        name="displayAddressPublicly"
                        control={control}
                        render={({ field }) => (
                          <div className="flex items-center gap-3 rounded-lg border p-3">
                            <Checkbox
                              id="displayAddressPublicly"
                              checked={field.value}
                              onCheckedChange={(checked) => field.onChange(Boolean(checked))}
                            />
                            <span className="text-sm text-muted-foreground">
                              Show full address on public profiles
                            </span>
                          </div>
                        )}
                      />
                    </div>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      {renderTooltipLabel(
                        'Website',
                        "Your company's website URL (include 'http://' or 'https://')",
                        'website'
                      )}
                      <Controller
                        name="website"
                        control={control}
                        render={({ field }) => (
                          <Input id="website" placeholder="https://yourcompany.com" {...field} />
                        )}
                      />
                      {errors.website && (
                        <p className="text-sm text-destructive">{errors.website.message}</p>
                      )}
                    </div>
                    <div className="space-y-2">
                      {renderTooltipLabel(
                        'Email',
                        'Your primary business email. This can differ from your login email.',
                        'email'
                      )}
                      <Controller
                        name="email"
                        control={control}
                        render={({ field }) => (
                          <Input id="email" type="email" placeholder="hello@yourcompany.com" {...field} />
                        )}
                      />
                      {errors.email && (
                        <p className="text-sm text-destructive">{errors.email.message}</p>
                      )}
                    </div>
                  </div>

                  <div className="space-y-2">
                    {renderTooltipLabel('Description', undefined, 'description')}
                    <Controller
                      name="description"
                      control={control}
                      render={({ field }) => (
                        <div className="min-h-[200px] rounded-md border">
                          <ReactQuill
                            theme="snow"
                            value={field.value || ''}
                            onChange={field.onChange}
                            modules={quillModules}
                            className="h-[150px]"
                          />
                        </div>
                      )}
                    />
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      {renderTooltipLabel(
                        'Video URL (YouTube)',
                        'Include a video from YouTube to help potential clients learn more about you. Simply copy and paste any URL from YouTube.',
                        'videoUrl'
                      )}
                      <Controller
                        name="videoUrl"
                        control={control}
                        render={({ field }) => (
                          <Input id="videoUrl" placeholder="https://www.youtube.com/watch?v=..." {...field} />
                        )}
                      />
                      {errors.videoUrl && (
                        <p className="text-sm text-destructive">{errors.videoUrl.message}</p>
                      )}
                    </div>
                    <div className="space-y-2">
                      {renderTooltipLabel(
                        'Service Offered',
                        'i.e. Residential, Radon, Termite, Mold',
                        'serviceOffered'
                      )}
                      <Controller
                        name="serviceOffered"
                        control={control}
                        render={({ field }) => (
                          <Input id="serviceOffered" placeholder="Residential, Termite, Mold" {...field} />
                        )}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    {renderTooltipLabel('Service Area', undefined, 'serviceArea')}
                    <Controller
                      name="serviceArea"
                      control={control}
                      render={({ field }) => (
                        <Textarea
                          id="serviceArea"
                          placeholder="Charlotte metro area, Mecklenburg County, York County"
                          rows={4}
                          {...field}
                        />
                      )}
                    />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Inspector Information</CardTitle>
                  <CardDescription>Company owner details displayed publicly</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <Controller
                    name="inspectorProfileImage"
                    control={control}
                    render={({ field }) => (
                      <ImageUpload
                        label="Inspector Photo"
                        description="Used on your public profile"
                        shape="circle"
                        value={field.value || ''}
                        onChange={(url) => field.onChange(url ?? '')}
                        imageClassName="h-24 w-24"
                      />
                    )}
                  />
                  <div className="space-y-2">
                    {renderTooltipLabel('First Name', undefined, 'inspectorFirstName')}
                    <Controller
                      name="inspectorFirstName"
                      control={control}
                      render={({ field }) => (
                        <Input id="inspectorFirstName" placeholder="John" {...field} />
                      )}
                    />
                    {errors.inspectorFirstName && (
                      <p className="text-sm text-destructive">{errors.inspectorFirstName.message}</p>
                    )}
                  </div>
                  <div className="space-y-2">
                    {renderTooltipLabel('Last Name', undefined, 'inspectorLastName')}
                    <Controller
                      name="inspectorLastName"
                      control={control}
                      render={({ field }) => (
                        <Input id="inspectorLastName" placeholder="Doe" {...field} />
                      )}
                    />
                    {errors.inspectorLastName && (
                      <p className="text-sm text-destructive">{errors.inspectorLastName.message}</p>
                    )}
                  </div>
                  <div className="space-y-2">
                    {renderTooltipLabel('Direct Phone (w/ SMS)', undefined, 'inspectorPhone')}
                    <Controller
                      name="inspectorPhone"
                      control={control}
                      render={({ field }) => (
                        <Input id="inspectorPhone" type="tel" placeholder="+1 (555) 987-6543" {...field} />
                      )}
                    />
                  </div>
                  <div className="space-y-2">
                    {renderTooltipLabel(
                      'Credentials',
                      "Let potential clients know those certifications you've worked hard for, like 'InterNACHI Certified Home Inspector'.",
                      'inspectorCredentials'
                    )}
                    <Controller
                      name="inspectorCredentials"
                      control={control}
                      render={({ field }) => (
                        <Textarea
                          id="inspectorCredentials"
                          placeholder="InterNACHI Certified Home Inspector"
                          rows={4}
                          {...field}
                        />
                      )}
                    />
                  </div>
                </CardContent>
              </Card>
            </div>

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

