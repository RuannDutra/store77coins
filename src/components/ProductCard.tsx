import { Link } from "react-router-dom";
import { Zap, Clock, Star } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface ProductCardProps {
  id: string;
  name: string;
  price: number;
  image_url: string | null;
  delivery_type: "automatic" | "manual";
  category?: { name: string } | null;
  avgRating?: number | null;
  reviewCount?: number;
}

export const ProductCard = ({
  id,
  name,
  price,
  image_url,
  delivery_type,
  category,
  avgRating,
  reviewCount = 0,
}: ProductCardProps) => {
  return (
    <Link
      to={`/product/${id}`}
      className="group relative flex flex-col overflow-hidden rounded-xl border border-border bg-card shadow-card-dark transition-all hover:border-primary hover:shadow-yellow hover:-translate-y-1"
    >
      <div className="aspect-square overflow-hidden bg-muted">
        {image_url ? (
          <img
            src={image_url}
            alt={name}
            loading="lazy"
            className="h-full w-full object-contain transition-transform duration-500 group-hover:scale-110"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-muted-foreground">
            <span className="font-display text-4xl">77</span>
          </div>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-2 p-4">
        {category && (
          <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            {category.name}
          </span>
        )}
        <h3 className="font-display text-base font-semibold leading-tight line-clamp-2">
          {name}
        </h3>

        {/* Estrelas — só aparece após a primeira avaliação */}
        {avgRating != null && reviewCount > 0 && (
          <div className="flex items-center gap-1.5">
            <div className="flex">
              {Array.from({ length: 5 }).map((_, i) => (
                <Star
                  key={i}
                  className={`h-3.5 w-3.5 ${
                    i < Math.round(avgRating) ? "fill-primary text-primary" : "text-muted"
                  }`}
                />
              ))}
            </div>
            <span className="text-xs text-muted-foreground">
              {avgRating.toFixed(1)} ({reviewCount})
            </span>
          </div>
        )}

        <div className="mt-auto flex items-end justify-between gap-2 pt-2">
          <div>
            <p className="text-xs text-muted-foreground">a partir de</p>
            <p className="font-display text-xl font-bold text-primary">
              R$ {price.toFixed(2).replace(".", ",")}
            </p>
          </div>
          <Badge variant="outline" className="border-border text-xs gap-1">
            {delivery_type === "automatic" ? (
              <><Zap className="h-3 w-3" /> Auto</>
            ) : (
              <><Clock className="h-3 w-3" /> Manual</>
            )}
          </Badge>
        </div>
      </div>
    </Link>
  );
};
