"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export default function InspectionsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Inspections</h2>
        <p className="text-muted-foreground">
          Manage and view all your property inspections
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Your Inspections</CardTitle>
          <CardDescription>
            View, edit, and manage your property inspections
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex h-[400px] items-center justify-center text-muted-foreground">
            <div className="text-center space-y-4">
              <p>No inspections found</p>
              <Button>Create New Inspection</Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

