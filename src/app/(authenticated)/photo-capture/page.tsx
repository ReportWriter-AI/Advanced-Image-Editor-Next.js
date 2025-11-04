"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Camera } from 'lucide-react';

export default function PhotoCapturePage() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Photo Capture</h2>
        <p className="text-muted-foreground">
          Take photos for your inspection reports
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Camera</CardTitle>
          <CardDescription>
            Capture photos directly from your device
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex h-[400px] items-center justify-center text-muted-foreground">
            <div className="text-center space-y-4">
              <Camera className="h-16 w-16 mx-auto" />
              <p>Camera functionality coming soon</p>
              <Button>Enable Camera</Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

