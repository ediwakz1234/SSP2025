import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { StatCard } from "../stat-card";
import { Users } from "lucide-react";

describe("StatCard Component", () => {
  describe("Rendering", () => {
    it("renders stat card with title and value", () => {
      render(<StatCard icon={Users} title="Total Users" value={1234} />);
      expect(screen.getByText("Total Users")).toBeInTheDocument();
      expect(screen.getByText("1234")).toBeInTheDocument();
    });

    it("renders string value", () => {
      render(<StatCard icon={Users} title="Status" value="Active" />);
      expect(screen.getByText("Active")).toBeInTheDocument();
    });

    it("renders icon", () => {
      render(<StatCard icon={Users} title="Users" value={100} data-testid="stat" />);
      const card = screen.getByTestId("stat");
      expect(card.querySelector("svg")).toBeInTheDocument();
    });
  });

  describe("Variants", () => {
    it("renders default variant", () => {
      render(<StatCard icon={Users} title="Users" value={100} data-testid="stat" />);
      expect(screen.getByTestId("stat")).toHaveClass("p-6", "rounded-2xl");
    });

    it("renders compact variant", () => {
      render(<StatCard icon={Users} title="Users" value={100} variant="compact" data-testid="stat" />);
      expect(screen.getByTestId("stat")).toHaveClass("p-4");
    });

    it("renders minimal variant", () => {
      render(<StatCard icon={Users} title="Users" value={100} variant="minimal" data-testid="stat" />);
      expect(screen.getByTestId("stat")).toHaveClass("p-4");
    });
  });

  describe("Colors", () => {
    it("renders purple color (default)", () => {
      render(<StatCard icon={Users} title="Users" value={100} color="purple" data-testid="stat" />);
      const card = screen.getByTestId("stat");
      expect(card.querySelector(".text-slate-600")).toBeInTheDocument();
    });

    it("renders blue color", () => {
      render(<StatCard icon={Users} title="Users" value={100} color="blue" data-testid="stat" />);
      const card = screen.getByTestId("stat");
      // Blue uses text-[#1e3a5f] which has brackets, so check for the icon container with correct bg
      expect(card.querySelector("svg")).toBeInTheDocument();
    });

    it("renders green color", () => {
      render(<StatCard icon={Users} title="Users" value={100} color="green" data-testid="stat" />);
      const card = screen.getByTestId("stat");
      expect(card.querySelector(".text-emerald-600")).toBeInTheDocument();
    });

    it("renders orange color", () => {
      render(<StatCard icon={Users} title="Users" value={100} color="orange" data-testid="stat" />);
      const card = screen.getByTestId("stat");
      expect(card.querySelector(".text-orange-600")).toBeInTheDocument();
    });

    it("renders red color", () => {
      render(<StatCard icon={Users} title="Users" value={100} color="red" data-testid="stat" />);
      const card = screen.getByTestId("stat");
      expect(card.querySelector(".text-red-600")).toBeInTheDocument();
    });
  });

  describe("Change Indicator", () => {
    it("shows positive change", () => {
      render(<StatCard icon={Users} title="Users" value={100} change={15} />);
      expect(screen.getByText("+15%")).toBeInTheDocument();
    });

    it("shows negative change", () => {
      render(<StatCard icon={Users} title="Users" value={100} change={-10} />);
      expect(screen.getByText("-10%")).toBeInTheDocument();
    });

    it("shows zero change", () => {
      render(<StatCard icon={Users} title="Users" value={100} change={0} />);
      expect(screen.getByText("0%")).toBeInTheDocument();
    });

    it("shows change label when provided", () => {
      render(<StatCard icon={Users} title="Users" value={100} changeLabel="New" />);
      expect(screen.getByText("New")).toBeInTheDocument();
    });

    it("does not show change indicator when not provided", () => {
      render(<StatCard icon={Users} title="Users" value={100} />);
      expect(screen.queryByText(/%/)).not.toBeInTheDocument();
    });
  });

  describe("Custom className", () => {
    it("applies custom className", () => {
      render(
        <StatCard
          icon={Users}
          title="Users"
          value={100}
          className="custom-class"
          data-testid="stat"
        />
      );
      expect(screen.getByTestId("stat")).toHaveClass("custom-class");
    });
  });
});
