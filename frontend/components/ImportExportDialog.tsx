import * as Dialog from "@radix-ui/react-dialog";
import * as Tabs from "@radix-ui/react-tabs";
import { useState } from "react";
import axios from "axios";
import { Button } from "../components/ui/button";
import { Upload, FileJson, FileSpreadsheet, FileText, X } from "lucide-react";
import { toast } from "sonner";
import { Business } from "../data/businesses";


interface ImportExportDialogProps {
    onImportSuccess?: (data: Business[]) => void;
    onExportSuccess?: () => void;
}

export default function ImportExportDialog({
    onImportSuccess,
    onExportSuccess,
}: ImportExportDialogProps) {
    const [activeTab, setActiveTab] = useState("export");
    const [selectedFormat, setSelectedFormat] = useState("report");
    const [file, setFile] = useState<File | null>(null);
    const [uploading, setUploading] = useState(false);
    const [open, setOpen] = useState(false);

    const handleImport = async () => {
        if (!file) {
            toast.error("Please select a file to upload.");
            return;
        }

        const token = localStorage.getItem("access_token");
        if (!token) {
            toast.error("⚠️ No access token found. Please log in first.");
            return;
        }

        setUploading(true);
        const formData = new FormData();
        formData.append("file", file);

        try {
            const response = await axios.post<Business[]>(
                "http://127.0.0.1:8000/api/v1/clustering/import",
                formData,
                {
                    headers: {
                        "Content-Type": "multipart/form-data",
                        Authorization: `Bearer ${token}`,
                    },
                }
            );

            toast.success("✅ File imported successfully!");
            if (onImportSuccess) onImportSuccess(response.data);

            // Reset file and close dialog
            const input = document.getElementById("fileUpload") as HTMLInputElement;
            if (input) input.value = "";
            setFile(null);
            setOpen(false);
            setActiveTab("export");
        } catch (err) {
            console.error(err);
            toast.error("❌ Import failed. Please check your file or connection.");
        } finally {
            setUploading(false);
        }
    };



    const handleExport = async () => {
        const token = localStorage.getItem("access_token");
        if (!token) {
            toast.error("⚠️ No access token found. Please log in first.");
            return;
        }

        try {
            const response = await axios.get(
                `http://127.0.0.1:8000/api/v1/clustering/export/latest?format=${selectedFormat}`,
                {
                    responseType: "blob",
                    headers: {
                        Authorization: `Bearer ${token}`,
                    },
                }
            );

            if (!response.data || response.data.size === 0) {
                toast.warning("⚠️ No clustering results available to export.");
                return;
            }

            const extension =
                selectedFormat === "json"
                    ? "json"
                    : selectedFormat === "csv"
                        ? "csv"
                        : "txt";

            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement("a");
            link.href = url;
            link.setAttribute("download", `clustering_result.${extension}`);
            document.body.appendChild(link);
            link.click();
            link.parentNode?.removeChild(link);

            toast.success(`📦 Exported successfully as ${extension.toUpperCase()}`);

            // ✅ Notify parent (triggers resetToMock + navigation)
            if (onExportSuccess) onExportSuccess();

            // ✅ Close dialog
            setOpen(false);
            setActiveTab("export");
        } catch (err) {
            console.error(err);
            toast.error("❌ Failed to export data. Please try again.");
        }
    };


    return (
        <Dialog.Root open={open} onOpenChange={(newOpen) => {
            setOpen(newOpen);
            if (!newOpen) setActiveTab("export"); // Reset tab when closing
        }}>
            <Dialog.Trigger asChild>
                <Button variant="outline" className="flex items-center gap-2">
                    <Upload className="w-4 h-4" /> Import/Export
                </Button>
            </Dialog.Trigger>

            <Dialog.Portal>
                <Dialog.Overlay className="fixed inset-0 bg-black/40 z-40" />
                <Dialog.Content className="fixed z-50 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[480px] bg-white rounded-xl shadow-lg p-6 space-y-4">
                    <div className="flex justify-between items-center border-b pb-2">
                        <Dialog.Title className="text-lg font-semibold">
                            Import & Export Data
                        </Dialog.Title>
                        <Dialog.Description className="sr-only">
                            Upload or export clustering data
                        </Dialog.Description>
                        <Dialog.Close>
                            <X className="w-5 h-5 text-gray-500 hover:text-black cursor-pointer" />
                        </Dialog.Close>
                    </div>

                    <Tabs.Root value={activeTab} onValueChange={setActiveTab} className="w-full">
                        <Tabs.List className="flex justify-center space-x-2 bg-gray-100 rounded-lg p-1">
                            <Tabs.Trigger
                                value="export"
                                className={`px-3 py-1 rounded-md text-sm ${activeTab === "export" ? "bg-white shadow font-semibold" : ""
                                    }`}
                            >
                                Export Analysis
                            </Tabs.Trigger>
                            <Tabs.Trigger
                                value="import"
                                className={`px-3 py-1 rounded-md text-sm ${activeTab === "import" ? "bg-white shadow font-semibold" : ""
                                    }`}
                            >
                                Import Data
                            </Tabs.Trigger>
                        </Tabs.List>

                        {/* Export Section */}
                        <Tabs.Content value="export" className="mt-4 space-y-4">
                            <p className="text-sm text-gray-600">
                                Choose a format and export your latest clustering results.
                            </p>
                            <div className="grid grid-cols-3 gap-2">
                                <Button
                                    variant={selectedFormat === "json" ? "default" : "outline"}
                                    onClick={() => setSelectedFormat("json")}
                                    className="flex flex-col items-center gap-1"
                                >
                                    <FileJson className="w-4 h-4" />
                                    JSON
                                </Button>
                                <Button
                                    variant={selectedFormat === "csv" ? "default" : "outline"}
                                    onClick={() => setSelectedFormat("csv")}
                                    className="flex flex-col items-center gap-1"
                                >
                                    <FileSpreadsheet className="w-4 h-4" />
                                    CSV
                                </Button>
                                <Button
                                    variant={selectedFormat === "report" ? "default" : "outline"}
                                    onClick={() => setSelectedFormat("report")}
                                    className="flex flex-col items-center gap-1"
                                >
                                    <FileText className="w-4 h-4" />
                                    Report
                                </Button>
                            </div>

                            <Button onClick={handleExport} className="w-full mt-4">
                                Export as {selectedFormat.toUpperCase()}
                            </Button>
                        </Tabs.Content>

                        {/* Import Section */}
                        <Tabs.Content value="import" className="mt-4 space-y-4">
                            <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
                                <p className="text-sm text-gray-600 mb-2">
                                    Click below or drag and drop your CSV file
                                </p>
                                <input
                                    type="file"
                                    accept=".csv"
                                    onChange={(e) => setFile(e.target.files?.[0] || null)}
                                    className="hidden"
                                    id="fileUpload"
                                />
                                <label
                                    htmlFor="fileUpload"
                                    className="inline-block cursor-pointer border rounded-md px-4 py-2 bg-gray-100 hover:bg-gray-200 text-sm"
                                >
                                    Select File
                                </label>

                                {file && (
                                    <p className="text-xs text-gray-500 mt-2">
                                        Selected file: {file.name}
                                    </p>
                                )}
                            </div>

                            <div className="text-sm text-gray-600 bg-gray-50 p-3 rounded-md">
                                <p className="font-semibold mb-1">CSV Format Requirements:</p>
                                <ul className="list-disc pl-5 space-y-1">
                                    <li>Required: business_name, category, latitude, longitude</li>
                                    <li>Optional: street, zone_type</li>
                                    <li>Latitude/Longitude must be decimal numbers</li>
                                    <li>First row should contain headers</li>
                                </ul>
                            </div>

                            <Button
                                onClick={handleImport}
                                disabled={uploading}
                                className="w-full"
                            >
                                {uploading ? "Importing..." : "Import Data"}
                            </Button>
                        </Tabs.Content>
                    </Tabs.Root>
                </Dialog.Content>
            </Dialog.Portal>
        </Dialog.Root>
    );
}
