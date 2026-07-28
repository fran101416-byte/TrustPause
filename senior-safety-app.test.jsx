import React from "react";
import { render, screen, fireEvent, act } from "@testing-library/react";
import "@testing-library/jest-dom";
import App, {
  SetupScreen,
  HomeScreen,
  CallScreen,
  PhotoScreen,
  // eslint-disable-next-line no-unused-vars
  ChecklistScreen,
  SafeWordScreen,
  LearnScreen,
} from "./senior-safety-app.jsx";

// Mock lucide-react icons
jest.mock("lucide-react", () => {
  const originalModule = jest.requireActual("lucide-react");
  const iconNames = Object.keys(originalModule);
  const mockIcons = {};
  for (const iconName of iconNames) {
    // eslint-disable-next-line react/display-name
    mockIcons[iconName] = ({ "data-testid": testId, ...props }) => (
      <svg data-testid={testId || `icon-${iconName}`} {...props} />
    );
  }
  return mockIcons;
});

// Mock fetch
global.fetch = jest.fn();

// Mock window.location for profile ID and reload
const originalLocation = window.location;
beforeAll(() => {
  delete window.location;
  window.location = {
    ...originalLocation,
    pathname: "/profile/123xyz",
    reload: jest.fn(),
  };
});
afterAll(() => {
  window.location = originalLocation;
});

// Mock browser/environment APIs
Object.defineProperty(window.navigator, "share", {
  writable: true,
  value: jest.fn(),
});
Object.defineProperty(window.navigator, "canShare", {
  writable: true,
  value: jest.fn(),
});

Object.defineProperty(window.navigator, "geolocation", {
  writable: true,
  value: { getCurrentPosition: jest.fn() },
});

global.URL.createObjectURL = jest.fn((file) => `blob:${file.name}`);
global.URL.revokeObjectURL = jest.fn();

const mockSettings = {
  seniorName: "Rose",
  trustedName: "Daniel",
  trustedPhone: "555-123-4567",
  safeWord: "sunflower",
  notes: "Some private notes.",
};

describe("Senior Safety App", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    window.location.pathname = "/profile/123xyz";
    window.location.reload.mockClear();

    // Default mock for settings loaded via fetch
    fetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => mockSettings,
    });
  });

  describe("App component and routing", () => {
    it("shows loading state initially", async () => {
      fetch.mockImplementation(() => new Promise(() => {})); // Never resolves
      render(<App />);
      expect(screen.getByText("Loading…")).toBeInTheDocument();
    });

    it("shows HomeScreen by default after loading settings", async () => {
      render(<App />);
      expect(await screen.findByText("Hi, Rose")).toBeInTheDocument();
    });

    it("shows SetupScreen for a new user (profile not found)", async () => {
      fetch.mockResolvedValue({
        ok: false,
        status: 404,
        json: async () => ({}),
      });
      render(<App />);
      expect(await screen.findByRole("heading", { name: "Set Up" })).toBeInTheDocument();
    });

    it("shows an error for an invalid link (no profile ID)", async () => {
      window.location.pathname = "/";
      render(<App />);
      expect(await screen.findByText("Error: Invalid Link. Please check the link.")).toBeInTheDocument();
    });

    it("navigates to SetupScreen when Settings is clicked", async () => {
      render(<App />);
      await act(async () => {
        fireEvent.click(await screen.findByText("Settings"));
      });
      expect(screen.getByRole("heading", { name: "Set Up" })).toBeInTheDocument();
    });

    it("navigates to CallScreen when 'Call or Text' is clicked", async () => {
      render(<App />);
      await act(async () => {
        fireEvent.click(await screen.findByText("Call or Text Trusted Person"));
      });
      expect(screen.getByRole("heading", { name: "Reach Trusted Person" })).toBeInTheDocument();
    });

    it("navigates back to home from a sub-screen", async () => {
      render(<App />);
      await act(async () => {
        fireEvent.click(await screen.findByText("Settings"));
      });
      expect(screen.getByRole("heading", { name: "Set Up" })).toBeInTheDocument();

      await act(async () => {
        fireEvent.click(screen.getByLabelText("Go back"));
      });
      expect(await screen.findByText("Hi, Rose")).toBeInTheDocument();
    });

    it("deletes profile and reloads when confirmed in SetupScreen", async () => {
      // Mock fetch for DELETE call
      fetch
        .mockResolvedValueOnce({
          // for initial load
          ok: true,
          status: 200,
          json: async () => mockSettings,
        })
        .mockResolvedValueOnce({
          // for DELETE call
          ok: true,
          status: 204,
        });

      render(<App />);
      // Navigate to setup
      await act(async () => {
        fireEvent.click(await screen.findByText("Settings"));
      });

      // Open modal
      fireEvent.click(screen.getByText("Delete My Data"));
      expect(await screen.findByText("Delete All Data?")).toBeInTheDocument();

      // Confirm deletion
      await act(async () => {
        fireEvent.click(screen.getByText("Yes, Delete Everything"));
      });

      // Check fetch call for DELETE
      expect(fetch).toHaveBeenCalledWith("http://localhost:4000/profile/123xyz", {
        method: "DELETE",
      });

      // Check for reload
      expect(window.location.reload).toHaveBeenCalled();
    });
  });

  describe("SetupScreen", () => {
    it("renders form and saves settings on submit", async () => {
      const onDone = jest.fn();
      const save = jest.fn().mockResolvedValue(undefined);
      render(<SetupScreen settings={{}} save={save} onDone={onDone} deleteProfile={jest.fn()} />);

      fireEvent.change(screen.getByLabelText("Your name"), { target: { value: "Rose" } });
      fireEvent.change(screen.getByLabelText("Trusted person's name"), { target: { value: "Daniel" } });
      fireEvent.change(screen.getByLabelText("Trusted person's phone number"), { target: { value: "555-123-4567" } });
      fireEvent.change(screen.getByLabelText(/Family safe word/), { target: { value: "sunflower" } });
      fireEvent.change(screen.getByLabelText(/My Notes/), { target: { value: "Test notes" } });

      await act(async () => {
        fireEvent.click(screen.getByText("Save"));
      });

      expect(save).toHaveBeenCalledWith({
        seniorName: "Rose",
        trustedName: "Daniel",
        trustedPhone: "555-123-4567",
        safeWord: "sunflower",
        notes: "Test notes",
      });
      expect(onDone).toHaveBeenCalled();
    });

    it("shows an error if saving fails", async () => {
      const onDone = jest.fn();
      const save = jest.fn().mockRejectedValue(new Error("Network Error"));
      render(<SetupScreen settings={{}} save={save} onDone={onDone} deleteProfile={jest.fn()} />);

      fireEvent.change(screen.getByLabelText("Your name"), { target: { value: "Rose" } });

      await act(async () => {
        fireEvent.click(screen.getByText("Save"));
      });

      expect(save).toHaveBeenCalled();
      expect(onDone).not.toHaveBeenCalled();
      expect(await screen.findByText("Could not save settings. Please check your connection and try again.")).toBeInTheDocument();
      expect(screen.getByText("Save")).not.toBeDisabled(); // Button should be re-enabled
    });

    it("shows an error if profile deletion fails", async () => {
      const deleteProfile = jest.fn().mockRejectedValue(new Error("Server Down"));
      render(<SetupScreen settings={mockSettings} save={jest.fn()} onDone={jest.fn()} deleteProfile={deleteProfile} />);

      // Open modal
      fireEvent.click(screen.getByText("Delete My Data"));
      expect(await screen.findByText("Delete All Data?")).toBeInTheDocument();

      // Confirm deletion
      await act(async () => {
        fireEvent.click(screen.getByText("Yes, Delete Everything"));
      });

      expect(deleteProfile).toHaveBeenCalled();
      expect(screen.queryByText("Delete All Data?")).not.toBeInTheDocument();
      expect(await screen.findByText("Could not delete data. Please try again later.")).toBeInTheDocument();
    });
  });

  describe("HomeScreen", () => {
    it("displays welcome message with senior's name", () => {
      render(<HomeScreen settings={mockSettings} nav={() => {}} />);
      expect(screen.getByText("Hi, Rose")).toBeInTheDocument();
    });

    it("displays generic welcome if name is not set", () => {
      render(<HomeScreen settings={{}} nav={() => {}} />);
      expect(screen.getByText("TrustPause")).toBeInTheDocument();
    });
  });

  describe("CallScreen", () => {
    it("shows contact info and call/text buttons", () => {
      render(<CallScreen settings={mockSettings} onBack={() => {}} />);
      expect(screen.getByText(mockSettings.trustedName)).toBeInTheDocument();
      expect(screen.getByText(mockSettings.trustedPhone)).toBeInTheDocument();
      const callLink = screen.getByText(`Call ${mockSettings.trustedName}`).closest("a");
      expect(callLink).toHaveAttribute("href", "tel:5551234567");
      const textLink = screen.getByText(`Text ${mockSettings.trustedName}`).closest("a");
      expect(textLink).toHaveAttribute("href", expect.stringContaining("sms:5551234567"));
    });

    it("shows a message if no contact is set", () => {
      render(<CallScreen settings={{}} onBack={() => {}} />);
      expect(screen.getByText("No trusted person saved yet. Go to Settings to add one.")).toBeInTheDocument();
    });

    it("allows sharing location after confirming in a modal", async () => {
      const mockGeolocation = {
        getCurrentPosition: jest.fn().mockImplementationOnce((success) =>
          Promise.resolve(
            success({
              coords: {
                latitude: 34.0522,
                longitude: -118.2437,
              },
            })
          )
        ),
      };
      Object.defineProperty(window.navigator, "geolocation", {
        value: mockGeolocation,
        writable: true,
      });

      render(<CallScreen settings={mockSettings} onBack={() => {}} />);

      fireEvent.click(screen.getByText("Share My Location"));

      // Modal confirmation
      expect(await screen.findByText("Share Location?")).toBeInTheDocument();
      fireEvent.click(screen.getByText("Yes, Share"));

      expect(screen.queryByText("Share Location?")).not.toBeInTheDocument();

      expect(screen.getByText("Getting Location...")).toBeInTheDocument();

      const successButton = await screen.findByText("Location Ready! Tap to Text");
      expect(successButton.closest("a")).toHaveAttribute("href", expect.stringContaining("https://www.google.com/maps?q=34.0522,-118.2437"));
    });
  });

  describe("PhotoScreen", () => {
    it("allows taking and saving a picture", async () => {
      render(<PhotoScreen settings={mockSettings} onBack={() => {}} />);
      expect(screen.getByText("Open Camera")).toBeInTheDocument();

      const file = new File(["(⌐□_□)"], "photo.png", { type: "image/png" });
      const fileInput = screen.getByTestId("icon-Camera").closest("button").previousSibling;

      await act(async () => {
        fireEvent.change(fileInput, { target: { files: [file] } });
      });

      expect(screen.getByAltText("Captured document")).toBeInTheDocument();
      expect(screen.getByText("Retake Picture")).toBeInTheDocument();
      expect(screen.getByText("Save Picture to My Phone")).toBeInTheDocument();

      const downloadLink = screen.getByText("Save Picture to My Phone").closest("a");
      expect(downloadLink).toHaveAttribute("href", "blob:photo.png");
      expect(downloadLink).toHaveAttribute("download", "photo-for-Daniel.jpg");
    });

    describe("AI image analysis", () => {
      beforeEach(async () => {
        // Setup: render and upload a photo
        render(<PhotoScreen settings={mockSettings} onBack={() => {}} />);
        const file = new File(["(⌐□_□)"], "photo.png", { type: "image/png" });
        const fileInput = screen.getByTestId("icon-Camera").closest("button").previousSibling;
        await act(async () => {
          fireEvent.change(fileInput, { target: { files: [file] } });
        });
        await screen.findByAltText("Captured document");
      });

      it("shows 'Analyzing...' state when analysis is in progress", async () => {
        fetch.mockImplementation(() => new Promise(() => {})); // Never resolves

        const analyzeButton = screen.getByText("Analyze for AI");
        fireEvent.click(analyzeButton);

        expect(await screen.findByText("Analyzing...")).toBeInTheDocument();
        expect(analyzeButton).toBeDisabled();
      });

      it("shows a warning for a likely AI-generated image", async () => {
        fetch.mockResolvedValue({
          ok: true,
          json: async () => ({ success: true, score: 0.95 }),
        });

        await act(async () => {
          fireEvent.click(screen.getByText("Analyze for AI"));
        });

        expect(fetch).toHaveBeenCalledWith("http://localhost:4000/analyze-image", expect.any(Object));
        const warning = await screen.findByText(/This image is LIKELY AI-GENERATED/);
        expect(warning).toBeInTheDocument();
      });

      it("shows a success message for a likely real image", async () => {
        fetch.mockResolvedValue({
          ok: true,
          json: async () => ({ success: true, score: 0.1 }),
        });
        await act(async () => { fireEvent.click(screen.getByText("Analyze for AI")); });
        const successMsg = await screen.findByText(/This image appears to be a REAL PHOTOGRAPH/);
        expect(successMsg).toBeInTheDocument();
      });

      it("shows an error if analysis fails", async () => {
        fetch.mockRejectedValue(new Error("API is down"));

        await act(async () => {
          fireEvent.click(screen.getByText("Analyze for AI"));
        });

        const errorMsg = await screen.findByText("Analysis failed. Please check your connection and try again.");
        expect(errorMsg).toBeInTheDocument();
        expect(screen.getByText("Analyze for AI")).not.toBeDisabled();
      });
    });
  });

  describe("ChecklistScreen", () => {
    it("shows a warning when a scam indicator is checked", async () => {
      render(<ChecklistScreen settings={mockSettings} nav={() => {}} onBack={() => {}} />);

      expect(screen.queryByText(/Stop. Don't send anything yet./)).not.toBeInTheDocument();

      const giftCardButton = screen.getByText("Asked you to buy gift cards");
      await act(async () => {
        fireEvent.click(giftCardButton);
      });

      expect(screen.getByText(/Stop. Don't send anything yet./)).toBeInTheDocument();

      await act(async () => {
        fireEvent.click(giftCardButton);
      });

      expect(screen.queryByText(/Stop. Don't send anything yet./)).not.toBeInTheDocument();
    });
  });

  describe("SafeWordScreen", () => {
    it("reveals the safe word on button click", async () => {
      render(<SafeWordScreen settings={mockSettings} onBack={() => {}} />);

      expect(screen.queryByText(mockSettings.safeWord)).not.toBeInTheDocument();

      const revealButton = screen.getByText("Show Safe Word");
      await act(async () => {
        fireEvent.click(revealButton);
      });

      expect(screen.getByText(mockSettings.safeWord)).toBeInTheDocument();
    });

    it("shows a message if no safe word is set", () => {
      render(<SafeWordScreen settings={{}} onBack={() => {}} />);
      expect(screen.getByText("No safe word saved yet. Add one in Settings with your family.")).toBeInTheDocument();
    });
  });

  describe("LearnScreen", () => {
    it("functions as an accordion", async () => {
      render(<LearnScreen onBack={() => {}} />);
      const firstItemTitle = "Fake Mail & Prize Letters";
      const firstItemBody =
        "A letter says you won money or a prize but must pay a 'fee' or 'tax' first to collect it. Real prizes never ask you to pay to receive them.";

      // Body is initially hidden
      expect(screen.queryByText(firstItemBody)).not.toBeInTheDocument();

      // Click to open
      const titleButton = screen.getByText(firstItemTitle);
      await act(async () => {
        fireEvent.click(titleButton);
      });
      expect(screen.getByText(firstItemBody)).toBeInTheDocument();

      // Click again to close
      await act(async () => {
        fireEvent.click(titleButton);
      });
      expect(screen.queryByText(firstItemBody)).not.toBeInTheDocument();
    });
  });

  describe("Phone helper functions", () => {
    // This is just an example of how you would test the helpers if they were exported.
    // Since they are not, their functionality is tested through the components that use them.
    // For example, CallScreen tests the hrefs.
    // If you were to export them:
    // import { cleanPhone, telHref, smsHref } from './senior-safety-app.jsx';
    //
    // test('cleanPhone removes non-numeric characters except +', () => {
    //   expect(cleanPhone(' (555) 123-4567 ')).toBe('5551234567');
    //   expect(cleanPhone('+1-800-555-1212')).toBe('+18005551212');
    //   expect(cleanPhone(null)).toBe('');
    // });
    //
    // test('telHref creates a tel: link', () => {
    //   expect(telHref('555-123-4567')).toBe('tel:5551234567');
    // });
    //
    // test('smsHref creates an sms: link with encoded body', () => {
    //   expect(smsHref('555-123-4567', 'Hello there!')).toBe('sms:5551234567?&body=Hello%20there!');
    // });
    it("are tested via component integration", () => {
      // This is a placeholder test to acknowledge the helpers are tested indirectly.
      expect(true).toBe(true);
    });
  });
});