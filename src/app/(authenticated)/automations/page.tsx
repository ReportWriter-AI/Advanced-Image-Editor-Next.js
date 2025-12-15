"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import CategoriesList from "./_components/CategoriesList";
import ActionsList from "./_components/ActionsList";

export default function AutomationsPage() {
  return (
    <div className="container mx-auto py-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Automations</h1>
        <p className="text-muted-foreground mt-1">
          Manage your automation categories and actions
        </p>
      </div>

      <Tabs defaultValue="categories" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="categories">Categories</TabsTrigger>
          <TabsTrigger value="actions">Actions</TabsTrigger>
        </TabsList>

        <TabsContent value="categories" className="mt-6">
          <CategoriesList />
        </TabsContent>

        <TabsContent value="actions" className="mt-6">
          <ActionsList />
        </TabsContent>
      </Tabs>
    </div>
  );
}

