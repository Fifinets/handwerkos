
import { Button } from "@/components/ui/button";
import { Users } from "lucide-react";
import { useNavigate } from "react-router-dom";

const ManagerNavigation = () => {
  const navigate = useNavigate();

  return (
    <div className="mb-6">
      <Button 
        onClick={() => navigate('/employee-management')}
        className="bg-green-600 hover:bg-green-700"
      >
        <Users className="h-4 w-4 mr-2" />
        Mitarbeiterverwaltung
      </Button>
    </div>
  );
};

export default ManagerNavigation;
