'use client';

import React, { useRef, useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import QRScanner from 'qr-scanner';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { 
  Camera, 
  Upload, 
  CheckCircle, 
  XCircle, 
  AlertTriangle, 
  Loader2, 
  ScanLine, 
  User, 
  MapPin, 
  Calendar, 
  Clock, 
  CreditCard,
  RefreshCw
} from "lucide-react";
import { cn } from "@/lib/utils";

export default function ScanQRClient() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [scanning, setScanning] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [scannedRaw, setScannedRaw] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const scannerRef = useRef<QRScanner | null>(null);
  const { user } = useAuth();

  useEffect(() => {
    return () => {
      if (scannerRef.current) {
        scannerRef.current.stop();
        scannerRef.current.destroy();
      }
    };
  }, []);

  const startCamera = async () => {
    setError(null);
    setResult(null);
    setScannedRaw(null);
    try {
      if (!videoRef.current) return;
      const scanner = new QRScanner(videoRef.current, (decoded: any) => {
        // qr-scanner might return object or string depending on version/options
        const val = typeof decoded === 'string' ? decoded : decoded.data;
        scanner.stop();
        setScanning(false);
        handleScanValue(val);
      }, {
        highlightScanRegion: true,
        highlightCodeOutline: true,
      });
      scannerRef.current = scanner;
      await scanner.start();
      setScanning(true);
    } catch (e: any) {
      console.error(e);
      setError(String(e?.message || e));
    }
  };

  const stopCamera = () => {
    if (scannerRef.current) {
      scannerRef.current.stop();
      scannerRef.current.destroy();
      scannerRef.current = null;
    }
    setScanning(false);
  };

  const handleUpload = async (file: File | null) => {
    if (!file) return;
    setError(null);
    setResult(null);
    setScannedRaw(null);
    setLoading(true);
    try {
      const scanRes = await QRScanner.scanImage(file, { returnDetailedScanResult: true });
      if (!scanRes) throw new Error('No QR code found in image');
      const payload = typeof scanRes === 'string' ? scanRes : (scanRes as any).data || JSON.stringify(scanRes);
      handleScanValue(payload);
    } catch (e: any) {
      console.error(e);
      setError(String(e?.message || e));
      setLoading(false);
    }
  };

  const handleScanValue = async (value: string) => {
    setResult(null);
    setError(null);
    setScannedRaw(value);
    setLoading(true);
    
    try {
      let token = '';
      if (user) {
        token = await user.getIdToken();
      } else {
        token = localStorage.getItem('id_token') || '';
      }

      const res = await fetch('/api/invoices/verify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ qr: value }),
      });
      
      const text = await res.text();
      let json: any = null;
      try {
        json = text ? JSON.parse(text) : null;
      } catch (e) {
        // ignore
      }

      if (!res.ok) {
        if (res.status === 401) {
          setError('Unauthorized — please login as a manager');
        } else if (json?.error) {
          setError(json.error);
        } else {
          setError(`Server responded ${res.status}: ${text.slice(0, 100)}`);
        }
        return;
      }
      setResult(json ?? text);
    } catch (e: any) {
      console.error(e);
      setError(String(e?.message || e));
    } finally {
      setLoading(false);
    }
  };

  const resetScan = () => {
    setResult(null);
    setError(null);
    setScannedRaw(null);
    stopCamera();
  };

  return (
    <div className="max-w-5xl mx-auto p-4 md:p-6 space-y-8">
       {/* Header */}
       <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Scan Booking QR</h1>
          <p className="text-muted-foreground mt-1">Verify customer bookings by scanning their invoice QR code.</p>
        </div>
        {(result || error) && (
          <Button variant="outline" onClick={resetScan} className="gap-2">
            <RefreshCw className="h-4 w-4" />
            Reset Scanner
          </Button>
        )}
       </div>

       <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
          {/* Left Column: Scanner */}
          <Card className="border-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ScanLine className="h-5 w-5 text-primary" />
                Scanner
              </CardTitle>
              <CardDescription>Use your camera or upload a QR image</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Camera Viewport */}
              <div className="relative aspect-video bg-black rounded-lg overflow-hidden shadow-inner flex items-center justify-center group">
                <video 
                  ref={videoRef} 
                  className={cn("w-full h-full object-cover", !scanning && "opacity-50")} 
                />
                {!scanning && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-white/70 pointer-events-none">
                    <Camera className="h-12 w-12 mb-2 opacity-50" />
                    <p className="text-sm font-medium">Camera is off</p>
                  </div>
                )}
                {scanning && (
                   <div className="absolute inset-0 border-2 border-primary/50 m-8 rounded-lg animate-pulse pointer-events-none"></div>
                )}
              </div>

              {/* Controls */}
              <div className="flex flex-col gap-4">
                {!scanning ? (
                  <Button onClick={startCamera} size="lg" className="w-full gap-2">
                    <Camera className="h-5 w-5" />
                    Start Camera
                  </Button>
                ) : (
                  <Button onClick={stopCamera} variant="destructive" size="lg" className="w-full gap-2">
                    <XCircle className="h-5 w-5" />
                    Stop Camera
                  </Button>
                )}

                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t" />
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-background px-2 text-muted-foreground">Or upload image</span>
                  </div>
                </div>

                <div className="grid w-full max-w-sm items-center gap-1.5 mx-auto">
                  <Label htmlFor="picture" className="sr-only">Upload QR</Label>
                  <div className="flex gap-2">
                    <Input 
                      id="picture" 
                      type="file" 
                      accept="image/*" 
                      className="cursor-pointer"
                      onChange={(e) => handleUpload(e.target.files ? e.target.files[0] : null)}
                    />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Right Column: Results */}
          <div className="space-y-6">
            {loading && (
               <Card className="border-dashed">
                 <CardContent className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                   <Loader2 className="h-10 w-10 animate-spin mb-4 text-primary" />
                   <p>Verifying QR code...</p>
                 </CardContent>
               </Card>
            )}

            {!loading && !result && !error && (
              <Card className="bg-muted/50 border-dashed">
                <CardContent className="flex flex-col items-center justify-center py-16 text-muted-foreground text-center">
                  <ScanLine className="h-16 w-16 mb-4 opacity-20" />
                  <h3 className="text-lg font-medium text-foreground">Ready to Scan</h3>
                  <p className="max-w-xs mt-2">Scan a booking QR code to view details and verify validity.</p>
                </CardContent>
              </Card>
            )}

            {error && (
              <Alert variant="destructive" className="animate-in fade-in slide-in-from-bottom-4">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Verification Failed</AlertTitle>
                <AlertDescription className="mt-2">
                  {error}
                  {scannedRaw && (
                    <div className="mt-4 p-2 bg-destructive/10 rounded text-xs font-mono break-all">
                      Raw: {scannedRaw.slice(0, 100)}{scannedRaw.length > 100 ? '...' : ''}
                    </div>
                  )}
                </AlertDescription>
              </Alert>
            )}

            {result && (
              <Card className={cn(
                "border-2 animate-in fade-in slide-in-from-bottom-4 overflow-hidden",
                result.ok && !result.stale ? "border-green-500/50 shadow-lg shadow-green-500/10" : "border-yellow-500/50"
              )}>
                <div className={cn(
                  "p-4 flex items-center gap-3 text-white",
                  result.ok && !result.stale ? "bg-green-600" : "bg-yellow-600"
                )}>
                  {result.ok && !result.stale ? (
                    <CheckCircle className="h-6 w-6" />
                  ) : (
                    <AlertTriangle className="h-6 w-6" />
                  )}
                  <div>
                    <h3 className="font-bold text-lg">
                      {result.ok && !result.stale ? "Valid Booking" : "Warning: Stale/Invalid"}
                    </h3>
                    {result.stale && <p className="text-xs opacity-90">This QR code timestamp is older than 24h.</p>}
                  </div>
                </div>

                <CardContent className="p-6 space-y-6">
                  {/* Booking Info */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <Label className="text-muted-foreground text-xs uppercase tracking-wider">Date</Label>
                      <div className="flex items-center gap-2 font-medium">
                        <Calendar className="h-4 w-4 text-primary" />
                        {result.booking?.date}
                      </div>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-muted-foreground text-xs uppercase tracking-wider">Time</Label>
                      <div className="flex items-center gap-2 font-medium">
                        <Clock className="h-4 w-4 text-primary" />
                        {result.booking?.startTime} - {result.booking?.endTime}
                      </div>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-muted-foreground text-xs uppercase tracking-wider">Amount</Label>
                      <div className="flex items-center gap-2 font-medium text-green-600">
                        <CreditCard className="h-4 w-4" />
                        Rs. {result.booking?.amount}
                      </div>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-muted-foreground text-xs uppercase tracking-wider">Status</Label>
                      <Badge variant={result.booking?.status === 'confirmed' ? 'default' : 'secondary'}>
                        {result.booking?.status || 'Unknown'}
                      </Badge>
                    </div>
                  </div>

                  <Separator />

                  {/* User Info */}
                  <div className="space-y-3">
                    <h4 className="font-semibold flex items-center gap-2">
                      <User className="h-4 w-4" /> Customer Details
                    </h4>
                    <div className="bg-muted/50 p-3 rounded-lg space-y-1 text-sm">
                      <p><span className="text-muted-foreground">Name:</span> {result.user?.name || result.user?.displayName || 'N/A'}</p>
                      <p><span className="text-muted-foreground">Email:</span> {result.user?.email || 'N/A'}</p>
                      <p><span className="text-muted-foreground">User ID:</span> <span className="font-mono text-xs">{result.booking?.userId}</span></p>
                    </div>
                  </div>

                  {/* Venue Info */}
                  <div className="space-y-3">
                    <h4 className="font-semibold flex items-center gap-2">
                      <MapPin className="h-4 w-4" /> Venue
                    </h4>
                    <div className="text-sm text-muted-foreground">
                      <p>{result.venue?.name}</p>
                      <p>{result.venue?.address}</p>
                    </div>
                  </div>
                  
                  <div className="text-xs text-muted-foreground text-center pt-4 border-t">
                    Booking ID: <span className="font-mono">{result.booking?.id || result.booking?.bookingId}</span>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
       </div>
    </div>
  );
}
