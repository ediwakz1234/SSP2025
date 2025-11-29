import { useEffect, useMemo, useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../ui/card";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import { Badge } from "../ui/badge";
import { ScrollArea } from "../ui/scroll-area";
import { Separator } from "../ui/separator";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";
import { toast } from "sonner";
import {
  Database,
  Plus,
  Edit2,
  Trash2,
  Download,
  Upload,
  RefreshCw,
  Building2,
  MapPin,
  Save,
  X,
} from "lucide-react";
import {
  getSeedData,
  updateSeedBusiness,
  createSeedBusiness,
  deleteSeedBusiness,
  resetSeedData,
} from "../../lib/api-client";

type Business = {
  id?: number;
  business_id?: number;
  business_name?: string;
  name?: string;
  category?: string;
  type?: string;
  latitude?: number;
  longitude?: number;
  lat?: number;
  lng?: number;
  street?: string;
  address?: string;
  zone_type?: string;
  created_at?: string;
};

// helpers to safely map whatever backend returns
const getDisplayName = (b: Business) =>
  b.business_name || b.name || "Unnamed business";
const getDisplayCategory = (b: Business) => b.category || b.type || "Unknown";
const getDisplayStreet = (b: Business) =>
  b.street || b.address || "No address";
const getDisplayZone = (b: Business) => b.zone_type || "Unzoned";

export function SeedDataManagement() {
  // ⬅️ token is now read internally instead of passed as prop
  const accessToken = localStorage.getItem("access_token") || "";

  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [zoneFilter, setZoneFilter] = useState<string>("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [selectedBusiness, setSelectedBusiness] = useState<Business | null>(
    null
  );
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [form, setForm] = useState({
    name: "",
    category: "",
    street: "",
    zone_type: "",
    latitude: "",
    longitude: "",
  });

  const fetchData = async () => {
    if (!accessToken) {
      toast.error("Missing access token. Please log in again.");
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const res = await getSeedData(accessToken);
      if (res?.success) {
        setBusinesses(res.businesses || res.data || []);
      } else {
        toast.error(res?.error || "Failed to fetch seed data");
      }
    } catch (error) {
      console.error(error);
      toast.error("Failed to fetch seed data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const categories = useMemo(
    () =>
      Array.from(
        new Set(
          businesses.map((b) => getDisplayCategory(b)).filter(Boolean)
        )
      ).sort(),
    [businesses]
  );

  const zones = useMemo(
    () =>
      Array.from(
        new Set(
          businesses.map((b) => getDisplayZone(b)).filter(Boolean)
        )
      ).sort(),
    [businesses]
  );

  const filteredBusinesses = useMemo(() => {
    let result = [...businesses];

    if (categoryFilter !== "all") {
      result = result.filter(
        (b) => getDisplayCategory(b) === categoryFilter
      );
    }
    if (zoneFilter !== "all") {
      result = result.filter((b) => getDisplayZone(b) === zoneFilter);
    }
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter((b) => {
        const name = getDisplayName(b).toLowerCase();
        const street = getDisplayStreet(b).toLowerCase();
        const category = getDisplayCategory(b).toLowerCase();
        return (
          name.includes(q) || street.includes(q) || category.includes(q)
        );
      });
    }

    return result;
  }, [businesses, categoryFilter, zoneFilter, searchQuery]);

  const handleOpenEdit = (business?: Business) => {
    const b = business ?? null;
    setSelectedBusiness(b);
    setForm({
      name: b ? getDisplayName(b) : "",
      category: b ? getDisplayCategory(b) : "",
      street: b ? getDisplayStreet(b) : "",
      zone_type: b ? getDisplayZone(b) : "",
      latitude:
        b?.latitude?.toString() ??
        b?.lat?.toString() ??
        "",
      longitude:
        b?.longitude?.toString() ??
        b?.lng?.toString() ??
        "",
    });
    setEditDialogOpen(true);
  };

  const handleSave = async () => {
    if (!accessToken) {
      toast.error("Missing access token. Please log in again.");
      return;
    }

    try {
      const payload = {
        business_name: form.name.trim(),
        category: form.category.trim(),
        street: form.street.trim(),
        zone_type: form.zone_type.trim(),
        latitude: form.latitude ? Number(form.latitude) : null,
        longitude: form.longitude ? Number(form.longitude) : null,
      };

      if (!payload.business_name || !payload.category) {
        toast.error("Name and category are required");
        return;
      }

      let result;
      if (selectedBusiness?.id || selectedBusiness?.business_id) {
        result = await updateSeedBusiness(
          selectedBusiness.id ?? selectedBusiness.business_id!,
          payload,
          accessToken
        );
      } else {
        result = await createSeedBusiness(payload, accessToken);
      }

      if (result?.success) {
        toast.success("Seed business saved");
        setEditDialogOpen(false);
        fetchData();
      } else {
        toast.error(result?.error || "Failed to save business");
      }
    } catch (error) {
      console.error(error);
      toast.error("Failed to save business");
    }
  };

  const handleDelete = async (business: Business) => {
    if (!accessToken) {
      toast.error("Missing access token. Please log in again.");
      return;
    }

    if (!confirm("Delete this business from seed data?")) return;

    try {
      const id = business.id ?? business.business_id;
      if (!id) {
        toast.error("Missing business id");
        return;
      }
      const result = await deleteSeedBusiness(id, accessToken);
      if (result?.success) {
        toast.success("Business deleted");
        fetchData();
      } else {
        toast.error(result?.error || "Failed to delete business");
      }
    } catch (error) {
      console.error(error);
      toast.error("Failed to delete business");
    }
  };

  const handleResetData = async () => {
    if (!accessToken) {
      toast.error("Missing access token. Please log in again.");
      return;
    }

    if (
      !confirm(
        "Reset seed data to default? This will clear your custom changes."
      )
    )
      return;

    try {
      const result = await resetSeedData(accessToken);
      if (result?.success) {
        toast.success("Seed data reset");
        fetchData();
      } else {
        toast.error(result?.error || "Failed to reset seed data");
      }
    } catch (error) {
      console.error(error);
      toast.error("Failed to reset seed data");
    }
  };

  const totalCategories = categories.length;
  const totalZones = zones.length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div>
          <h2 className="flex items-center gap-2 text-xl font-semibold tracking-tight">
            <Database className="h-5 w-5 text-purple-600" />
            Seed Data Management
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage the Sta. Cruz businesses used as input for K-Means clustering.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            className="gap-2 border-purple-200 text-purple-700 hover:bg-purple-50"
            onClick={fetchData}
            disabled={loading}
          >
            <RefreshCw className="h-4 w-4" />
            Refresh
          </Button>
          <Button
            size="sm"
            className="gap-2 bg-purple-600 text-white hover:bg-purple-700"
            onClick={() => handleOpenEdit()}
          >
            <Plus className="h-4 w-4" />
            Add business
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="gap-2 border-red-200 text-red-700 hover:bg-red-50"
            onClick={handleResetData}
          >
            <X className="h-4 w-4" />
            Reset seed data
          </Button>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="border-purple-100 bg-purple-50/80">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm">
              <Building2 className="h-4 w-4 text-purple-700" />
              Total businesses
            </CardTitle>
            <CardDescription>Entries in seed dataset</CardDescription>
          </CardHeader>
          <CardContent className="pb-3">
            <div className="text-2xl font-semibold">
              {businesses.length}
            </div>
          </CardContent>
        </Card>

        <Card className="border-purple-100">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm">
              <Database className="h-4 w-4 text-purple-600" />
              Categories
            </CardTitle>
            <CardDescription>Distinct types of businesses</CardDescription>
          </CardHeader>
          <CardContent className="pb-3">
            <div className="text-2xl font-semibold">
              {totalCategories}
            </div>
          </CardContent>
        </Card>

        <Card className="border-purple-100">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm">
              <MapPin className="h-4 w-4 text-purple-600" />
              Zone types
            </CardTitle>
            <CardDescription>Based on zoning classification</CardDescription>
          </CardHeader>
          <CardContent className="pb-3">
            <div className="text-2xl font-semibold">{totalZones}</div>
          </CardContent>
        </Card>
      </div>

      {/* Filters + list */}
      <Card className="border-purple-100">
        <CardHeader className="pb-3">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <CardTitle className="text-sm">Seed businesses</CardTitle>
              <CardDescription>
                Filter, edit, and manage seed businesses similar to your UI mockup.
              </CardDescription>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative w-full min-w-[200px] md:w-64">
                <Input
                  placeholder="Search by name, category, or street"
                  className="text-sm"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              <Select
                value={categoryFilter}
                onValueChange={setCategoryFilter}
              >
                <SelectTrigger className="w-[150px] text-sm">
                  <SelectValue placeholder="Category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All categories</SelectItem>
                  {categories.map((cat) => (
                    <SelectItem key={cat} value={cat}>
                      {cat}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={zoneFilter} onValueChange={setZoneFilter}>
                <SelectTrigger className="w-[150px] text-sm">
                  <SelectValue placeholder="Zone" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All zones</SelectItem>
                  {zones.map((z) => (
                    <SelectItem key={z} value={z}>
                      {z}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>

        <CardContent>
          <ScrollArea className="h-[420px] pr-3">
            <div className="space-y-2">
              {filteredBusinesses.map((b) => (
                <div
                  key={b.id ?? b.business_id}
                  className="flex items-start justify-between rounded-lg border border-purple-50 bg-white px-3 py-2 text-sm shadow-[0_1px_0_0_rgba(15,23,42,0.03)]"
                >
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">
                        {getDisplayName(b)}
                      </span>
                      <Badge
                        variant="outline"
                        className="border-purple-200 bg-purple-50 text-[10px] text-purple-700"
                      >
                        {getDisplayCategory(b)}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {getDisplayStreet(b)}
                    </p>
                    <p className="text-[11px] text-slate-500">
                      Zone:{" "}
                      <span className="font-medium">
                        {getDisplayZone(b)}
                      </span>
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                      <MapPin className="h-3 w-3" />
                      <span>
                        {b.latitude ?? b.lat ?? "—"},{" "}
                        {b.longitude ?? b.lng ?? "—"}
                      </span>
                    </div>
                    <div className="flex gap-1">
                      <Button
                        size="icon"
                        variant="outline"
                        className="h-7 w-7 border-purple-200"
                        onClick={() => handleOpenEdit(b)}
                      >
                        <Edit2 className="h-3 w-3" />
                      </Button>
                      <Button
                        size="icon"
                        variant="outline"
                        className="h-7 w-7 border-red-200 text-red-700"
                        onClick={() => handleDelete(b)}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}

              {!loading && filteredBusinesses.length === 0 && (
                <p className="py-6 text-center text-sm text-muted-foreground">
                  No businesses match this filter.
                </p>
              )}

              {loading && (
                <p className="py-6 text-center text-sm text-muted-foreground">
                  Loading seed businesses...
                </p>
              )}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Create / Edit dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Save className="h-4 w-4 text-purple-600" />
              {selectedBusiness ? "Edit business" : "Add business"}
            </DialogTitle>
            <DialogDescription>
              Update the business details used for clustering.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="grid gap-3">
              <div className="space-y-1">
                <Label>Business name</Label>
                <Input
                  value={form.name}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, name: e.target.value }))
                  }
                />
              </div>
              <div className="space-y-1">
                <Label>Category</Label>
                <Input
                  value={form.category}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, category: e.target.value }))
                  }
                  placeholder="e.g., Sari-sari, Pharmacy..."
                />
              </div>
              <div className="space-y-1">
                <Label>Street / address</Label>
                <Input
                  value={form.street}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, street: e.target.value }))
                  }
                />
              </div>
              <div className="space-y-1">
                <Label>Zone type</Label>
                <Input
                  value={form.zone_type}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, zone_type: e.target.value }))
                  }
                  placeholder="e.g., Residential, Commercial..."
                />
              </div>
            </div>

            <Separator />

            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-1">
                <Label>Latitude</Label>
                <Input
                  value={form.latitude}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, latitude: e.target.value }))
                  }
                />
              </div>
              <div className="space-y-1">
                <Label>Longitude</Label>
                <Input
                  value={form.longitude}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, longitude: e.target.value }))
                  }
                />
              </div>
            </div>
          </div>

          <DialogFooter className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => setEditDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              className="bg-purple-600 text-white hover:bg-purple-700"
              onClick={handleSave}
            >
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
