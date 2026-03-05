import {
  Utensils, Car, ShoppingBag, FileText, Banknote, Percent,
  ArrowLeftRight, Music, Heart, GraduationCap, Home, MoreHorizontal, Tag
} from 'lucide-react';

const ICON_MAP = {
  Utensils, Car, ShoppingBag, FileText, Banknote, Percent,
  ArrowLeftRight, Music, Heart, GraduationCap, Home, MoreHorizontal, Tag,
};

export function CategoryIcon({ name, size = 16, className, style }) {
  const Icon = ICON_MAP[name];
  if (!Icon) return <Tag size={size} className={className} style={style} />;
  return <Icon size={size} className={className} style={style} />;
}
