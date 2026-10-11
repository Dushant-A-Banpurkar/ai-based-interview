"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const mongoose_1 = __importDefault(require("mongoose"));
const dotenv = __importStar(require("dotenv"));
dotenv.config();
const mongodbURI = process.env.MONGODB_URI;
const connectMongoDB = async () => {
    try {
        if (!mongodbURI) {
            console.log("mongodburi");
            throw new Error("MONGODB_URI is missing from environment variable");
        }
        mongoose_1.default.connection.on("connected", () => {
            console.log("MongoDB event: connected");
        });
        mongoose_1.default.connection.on("error", (error) => {
            console.error("MongoDB event: connection error: ", error.message);
        });
        mongoose_1.default.connection.on("disconnected", () => {
            console.warn("MongoDB event: Disconnected from database.");
        });
        const connect = await mongoose_1.default.connect(mongodbURI, {
            maxPoolSize: 10,
            minPoolSize: 1,
            serverSelectionTimeoutMS: 5000,
            socketTimeoutMS: 45000,
            family: 4,
        });
        console.log(`MongoDb Connected: ${connect.connection.host}`);
        process.on("SIGINT", async () => {
            await mongoose_1.default.connection.close();
            console.log("MongoDB closed on app termination");
            process.exit(0);
        });
    }
    catch (error) {
        console.error("Something went wrong on MongoDB connection", error.message);
        process.exit(1);
    }
};
exports.default = connectMongoDB;
