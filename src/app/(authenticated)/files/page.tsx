"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { FolderOpen } from 'lucide-react';

export default function FilesPage() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">File Manager</h2>
        <p className="text-muted-foreground">
          Manage your inspection photos and documents
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Your Files</CardTitle>
          <CardDescription>
            Browse and manage all your uploaded files
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex h-[400px] items-center justify-center text-muted-foreground">
            <div className="text-center space-y-4">
              <FolderOpen className="h-16 w-16 mx-auto" />
              <p>No files uploaded yet</p>
              <Button>Upload Files</Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

