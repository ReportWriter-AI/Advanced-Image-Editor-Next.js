"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Separator } from '@/components/ui/separator';

export default function SettingsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Settings</h2>
        <p className="text-muted-foreground">
          Manage your application preferences
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Notifications</CardTitle>
          <CardDescription>
            Configure how you receive notifications
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center space-x-2">
            <Checkbox id="email-notifications" />
            <Label htmlFor="email-notifications" className="cursor-pointer">
              Email notifications
            </Label>
          </div>
          <div className="flex items-center space-x-2">
            <Checkbox id="sms-notifications" />
            <Label htmlFor="sms-notifications" className="cursor-pointer">
              SMS notifications
            </Label>
          </div>
          <div className="flex items-center space-x-2">
            <Checkbox id="push-notifications" />
            <Label htmlFor="push-notifications" className="cursor-pointer">
              Push notifications
            </Label>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Appearance</CardTitle>
          <CardDescription>
            Customize the look and feel of the application
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center space-x-2">
            <Checkbox id="dark-mode" />
            <Label htmlFor="dark-mode" className="cursor-pointer">
              Enable dark mode
            </Label>
          </div>
          <div className="flex items-center space-x-2">
            <Checkbox id="compact-view" />
            <Label htmlFor="compact-view" className="cursor-pointer">
              Compact view
            </Label>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Report Settings</CardTitle>
          <CardDescription>
            Configure default report preferences
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center space-x-2">
            <Checkbox id="auto-save" defaultChecked />
            <Label htmlFor="auto-save" className="cursor-pointer">
              Auto-save reports
            </Label>
          </div>
          <div className="flex items-center space-x-2">
            <Checkbox id="include-photos" defaultChecked />
            <Label htmlFor="include-photos" className="cursor-pointer">
              Include photos in reports by default
            </Label>
          </div>
          <div className="flex items-center space-x-2">
            <Checkbox id="watermark" />
            <Label htmlFor="watermark" className="cursor-pointer">
              Add watermark to photos
            </Label>
          </div>
        </CardContent>
      </Card>

      <Separator />

      <div className="flex justify-end">
        <Button>Save Settings</Button>
      </div>
    </div>
  );
}

