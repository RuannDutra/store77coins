import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Navbar } from "@/components/Navbar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, Lock } from "lucide-react";
import { AdminProducts } from "@/components/admin/AdminProducts";
import { AdminCategories } from "@/components/admin/AdminCategories";
import { AdminOrders } from "@/components/admin/AdminOrders";
import { AdminUsers } from "@/components/admin/AdminUsers";
import { AdminReviews } from "@/components/admin/AdminReviews";

const Admin = () => {
  const { user, isAdmin, loading } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState("orders");

  useEffect(() => {
    document.title = "Admin — 77 Coins";
  }, []);

  useEffect(() => {
    if (!loading && !user) navigate("/auth");
  }, [user, loading, navigate]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="container py-20 text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
        </div>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="container py-20 max-w-md mx-auto text-center">
          <div className="rounded-2xl border border-border bg-card p-10">
            <Lock className="h-12 w-12 mx-auto text-primary mb-4" />
            <h1 className="font-display text-2xl font-bold mb-2">Acesso restrito</h1>
            <p className="text-muted-foreground">
              Você precisa estar logado com uma conta admin para acessar esta área.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="container py-8">
        <h1 className="font-display text-3xl font-bold mb-6">Painel Admin</h1>
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="flex-wrap h-auto">
            <TabsTrigger value="orders">Pedidos</TabsTrigger>
            <TabsTrigger value="products">Produtos</TabsTrigger>
            <TabsTrigger value="categories">Categorias</TabsTrigger>
            <TabsTrigger value="users">Usuários</TabsTrigger>
            <TabsTrigger value="reviews">Avaliações</TabsTrigger>
          </TabsList>
          <TabsContent value="orders" className="mt-6">
            <AdminOrders />
          </TabsContent>
          <TabsContent value="products" className="mt-6">
            <AdminProducts />
          </TabsContent>
          <TabsContent value="categories" className="mt-6">
            <AdminCategories />
          </TabsContent>
          <TabsContent value="users" className="mt-6">
            <AdminUsers />
          </TabsContent>
          <TabsContent value="reviews" className="mt-6">
            <AdminReviews />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default Admin;
