import { Button } from "../ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../ui/card";
import { CheckCircle2 } from "lucide-react";
import { useNavigate } from "react-router-dom";

export function ResetPasswordSuccessPage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-linear-to-br from-blue-50 via-white to-purple-50 p-4">
      <Card className="w-full max-w-md shadow-xl">
        <CardHeader className="text-center space-y-4 pb-8">
          <div className="mx-auto w-16 h-16 bg-green-100 rounded-2xl flex items-center justify-center">
            <CheckCircle2 className="w-8 h-8 text-green-600" />
          </div>

          <CardTitle className="text-2xl font-semibold">
            Password Reset Successful
          </CardTitle>

          <CardDescription className="text-base text-muted-foreground">
            Your password has been updated. You may now log in safely.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          <Button className="w-full" onClick={() => navigate("/login")}>
            Go to Login
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
