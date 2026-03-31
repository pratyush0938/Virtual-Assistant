import uploadOnCloudinary from "../config/cloudinary.js";
import geminiResponse from "../gemini.js";
import User from "../models/user.model.js";
import moment from "moment";

// ================= GET CURRENT USER =================
export const getCurrentUser = async (req, res) => {
  try {
    const userId = req.userId;

    const user = await User.findById(userId).select("-password");

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    return res.status(200).json(user);
  } catch (error) {
    console.error("Get Current User Error:", error);
    return res.status(500).json({ message: "Get current user error" });
  }
};

// ================= UPDATE ASSISTANT =================
export const updateAssistant = async (req, res) => {
  try {
    const { assistantName, imageUrl } = req.body;

    let assistantImage;

    if (req.file) {
      assistantImage = await uploadOnCloudinary(req.file.path);
    } else {
      assistantImage = imageUrl;
    }

    const user = await User.findByIdAndUpdate(
      req.userId,
      {
        assistantName,
        assistantImage,
      },
      { new: true },
    ).select("-password");

    return res.status(200).json(user);
  } catch (error) {
    console.error("Update Assistant Error:", error);
    return res.status(500).json({ message: "Update assistant error" });
  }
};

// ================= ASK TO ASSISTANT =================
export const askToAssistant = async (req, res) => {
  try {
    const { command } = req.body;

    if (!command) {
      return res.status(400).json({ response: "Command is required" });
    }

    const user = await User.findById(req.userId);

    if (!user) {
      return res.status(404).json({ response: "User not found" });
    }

    // Save history
    user.history.push(command);
    await user.save();

    const userName = user.name;
    const assistantName = user.assistantName;

    // Call Gemini
    const result = await geminiResponse(command, assistantName, userName);

    if (!result) {
      return res
        .status(500)
        .json({ response: "Gemini did not return any response" });
    }

    // Extract JSON from Gemini text
    const jsonMatch = result.match(/{[\s\S]*}/);

    if (!jsonMatch) {
      return res.status(400).json({ response: "Sorry, I can't understand" });
    }

    let gemResult;

    try {
      gemResult = JSON.parse(jsonMatch[0]);
    } catch (err) {
      return res.status(400).json({ response: "Invalid JSON from Gemini" });
    }

    const type = gemResult.type;

    switch (type) {
      case "get-date":
        return res.json({
          type,
          userInput: gemResult.userInput,
          response: `Current date is ${moment().format("YYYY-MM-DD")}`,
        });

      case "get-time":
        return res.json({
          type,
          userInput: gemResult.userInput,
          response: `Current time is ${moment().format("hh:mm A")}`,
        });

      case "get-day":
        return res.json({
          type,
          userInput: gemResult.userInput,
          response: `Today is ${moment().format("dddd")}`,
        });

      case "get-month":
        return res.json({
          type,
          userInput: gemResult.userInput,
          response: `Current month is ${moment().format("MMMM")}`,
        });

      case "google-search":
      case "youtube-search":
      case "youtube-play":
      case "general":
      case "calculator-open":
      case "instagram-open":
      case "facebook-open":
      case "weather-show":
        return res.json({
          type,
          userInput: gemResult.userInput,
          response: gemResult.response,
        });

      default:
        return res.status(400).json({
          response: "I didn't understand that command.",
        });
    }
  } catch (error) {
    console.error("ASK ASSISTANT ERROR:", error);
    return res.status(500).json({
      response: "Ask assistant error",
    });
  }
};
