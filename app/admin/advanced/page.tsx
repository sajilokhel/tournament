"use client";

import React, { useState, useEffect } from "react";
import { db } from "@/lib/firebase";
import {
  collection,
  getDocs,
  doc,
  getDoc,
  query,
  limit,
  DocumentData,
} from "firebase/firestore";
import {
  ChevronRight,
  Database,
  FileJson,
  Folder,
  ArrowLeft,
  Search,
  RefreshCw,
  Copy,
} from "lucide-react";
import { toast } from "sonner";

import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { vscDarkPlus } from "react-syntax-highlighter/dist/esm/styles/prism";

// Known root collections in the system
const KNOWN_ROOT_COLLECTIONS = [
  "bookings",
  "grounds",
  "payments",
  "reviews",
  "users",
  "venueSlots",
  "venues",
];

export default function AdvancedModePage() {
  // Path segments: e.g. ["users", "123", "bookings"]
  const [path, setPath] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  // Data for the current view
  const [collectionDocs, setCollectionDocs] = useState<
    { id: string; data: DocumentData }[]
  >([]);
  const [docData, setDocData] = useState<DocumentData | null>(null);
  const [subcollectionName, setSubcollectionName] = useState("");

  // Derived state
  const isRoot = path.length === 0;
  const isCollection = path.length % 2 === 1;
  const isDocument = path.length > 0 && path.length % 2 === 0;

  const currentPathString = path.join("/");

  // Fetch data when path changes
  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path]);

  const fetchData = async () => {
    setLoading(true);
    setCollectionDocs([]);
    setDocData(null);

    try {
      if (isRoot) {
        // Nothing to fetch, we use KNOWN_ROOT_COLLECTIONS
      } else if (isCollection) {
        // Fetch documents in the collection
        // Path example: ["users"] or ["users", "123", "bookings"]
        const colRef = collection(db, path.join("/"));
        const q = query(colRef, limit(50)); // Limit to 50 for performance
        const snap = await getDocs(q);
        const docs = snap.docs.map((d) => ({ id: d.id, data: d.data() }));
        setCollectionDocs(docs);
      } else if (isDocument) {
        // Fetch single document data
        // Path example: ["users", "123"]
        const docRef = doc(db, path.join("/"));
        const snap = await getDoc(docRef);
        if (snap.exists()) {
          setDocData(snap.data());
        } else {
          setDocData(null);
          toast.error("Document does not exist");
        }
      }
    } catch (err) {
      console.error("Error fetching data:", err);
      toast.error("Failed to fetch data. Check permissions or path.");
    } finally {
      setLoading(false);
    }
  };

  const handleNavigate = (segment: string) => {
    setPath([...path, segment]);
  };

  const handleBack = () => {
    setPath(path.slice(0, -1));
  };

  const handleBreadcrumbClick = (index: number) => {
    setPath(path.slice(0, index + 1));
  };

  const handleRootClick = () => {
    setPath([]);
  };

  const handleEnterSubcollection = (e: React.FormEvent) => {
    e.preventDefault();
    if (subcollectionName.trim()) {
      handleNavigate(subcollectionName.trim());
      setSubcollectionName("");
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Copied to clipboard");
  };

  return (
    <div className="space-y-6 h-[calc(100vh-100px)] flex flex-col">
      <div className="flex items-center justify-between shrink-0">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Database className="h-6 w-6 text-primary" />
            Firestore Explorer
          </h1>
          <p className="text-muted-foreground">
            Read-only view of the database
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchData} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {/* Breadcrumbs */}
      <div className="flex items-center gap-2 text-sm bg-muted/50 p-2 rounded-md overflow-x-auto shrink-0">
        <Button
          variant="ghost"
          size="sm"
          className={`h-6 px-2 ${isRoot ? "font-bold text-primary" : ""}`}
          onClick={handleRootClick}
        >
          Root
        </Button>
        {path.map((segment, index) => (
          <React.Fragment key={index}>
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
            <Button
              variant="ghost"
              size="sm"
              className={`h-6 px-2 ${
                index === path.length - 1 ? "font-bold text-primary" : ""
              }`}
              onClick={() => handleBreadcrumbClick(index)}
            >
              {segment}
            </Button>
          </React.Fragment>
        ))}
      </div>

      {/* Main Content Area */}
      <div className="flex-1 min-h-0 border rounded-md bg-card flex overflow-hidden">
        {/* Left Sidebar: List of Items */}
        <div className="w-1/3 border-r flex flex-col min-w-[250px]">
          <div className="p-3 border-b bg-muted/30 font-medium text-sm flex items-center justify-between">
            <span>
              {isRoot
                ? "Collections"
                : isCollection
                ? "Documents"
                : "Subcollections"}
            </span>
            <Badge variant="outline" className="text-xs">
              {isRoot
                ? KNOWN_ROOT_COLLECTIONS.length
                : isCollection
                ? collectionDocs.length
                : "N/A"}
            </Badge>
          </div>
          <ScrollArea className="flex-1">
            <div className="p-2 space-y-1">
              {isRoot && (
                <>
                  {KNOWN_ROOT_COLLECTIONS.map((col) => (
                    <Button
                      key={col}
                      variant="ghost"
                      className="w-full justify-start font-normal"
                      onClick={() => handleNavigate(col)}
                    >
                      <Folder className="h-4 w-4 mr-2 text-blue-500" />
                      {col}
                    </Button>
                  ))}
                </>
              )}

              {isCollection && (
                <>
                  {collectionDocs.length === 0 && !loading && (
                    <div className="text-sm text-muted-foreground p-4 text-center">
                      No documents found.
                    </div>
                  )}
                  {collectionDocs.map((doc) => (
                    <Button
                      key={doc.id}
                      variant="ghost"
                      className="w-full justify-start font-normal truncate"
                      onClick={() => handleNavigate(doc.id)}
                    >
                      <FileJson className="h-4 w-4 mr-2 text-orange-500" />
                      <span className="truncate">{doc.id}</span>
                    </Button>
                  ))}
                </>
              )}

              {isDocument && (
                <div className="p-4 space-y-4">
                  <div className="text-sm text-muted-foreground">
                    Subcollections cannot be listed automatically. Enter name to
                    navigate:
                  </div>
                  <form onSubmit={handleEnterSubcollection} className="flex gap-2">
                    <Input
                      placeholder="e.g. bookings"
                      value={subcollectionName}
                      onChange={(e) => setSubcollectionName(e.target.value)}
                      className="h-8 text-sm"
                    />
                    <Button type="submit" size="sm" className="h-8">
                      Go
                    </Button>
                  </form>
                </div>
              )}
            </div>
          </ScrollArea>
        </div>

        {/* Right Content: Data View */}
        <div className="flex-1 flex flex-col min-w-0 bg-slate-50 dark:bg-slate-900/50">
          <div className="p-3 border-b bg-muted/30 font-medium text-sm flex items-center justify-between">
            <span>Data View</span>
            {isDocument && docData && (
              <Button
                variant="ghost"
                size="sm"
                className="h-6"
                onClick={() => copyToClipboard(JSON.stringify(docData, null, 2))}
              >
                <Copy className="h-3 w-3 mr-1" /> Copy JSON
              </Button>
            )}
          </div>
          <ScrollArea className="flex-1 p-4">
            {isRoot && (
              <div className="flex flex-col items-center justify-center h-full text-muted-foreground space-y-2">
                <Database className="h-12 w-12 opacity-20" />
                <p>Select a collection to browse</p>
              </div>
            )}

            {isCollection && (
              <div className="flex flex-col items-center justify-center h-full text-muted-foreground space-y-2">
                <FileJson className="h-12 w-12 opacity-20" />
                <p>Select a document to view data</p>
              </div>
            )}

            {isDocument && (
              <>
                {loading ? (
                  <div className="p-4 text-sm">Loading data...</div>
                ) : docData ? (
                  <div className="rounded-md overflow-hidden border shadow-sm">
                    <SyntaxHighlighter
                      language="json"
                      style={vscDarkPlus}
                      customStyle={{ margin: 0, fontSize: "12px" }}
                      wrapLongLines={true}
                    >
                      {JSON.stringify(docData, null, 2)}
                    </SyntaxHighlighter>
                  </div>
                ) : (
                  <div className="p-4 text-sm text-muted-foreground">
                    No data or document does not exist.
                  </div>
                )}
              </>
            )}
          </ScrollArea>
        </div>
      </div>
    </div>
  );
}
