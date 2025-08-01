import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { ActivityService, CropService, TaskService } from "@/lib/db";

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");

    const start = startDate ? new Date(startDate) : undefined;
    const end = endDate ? new Date(endDate) : undefined;

    // Get basic counts
    const [crops, taskStats] = await Promise.all([
      CropService.findAllByUser(session.user.id),
      TaskService.getTaskStats(session.user.id),
    ]);

    // Get activity statistics
    const [waterStats, fertilizerStats, yieldStats, pestStats] =
      await Promise.all([
        ActivityService.getWaterUsageStats(session.user.id, start, end),
        ActivityService.getFertilizerUsageStats(session.user.id, start, end),
        ActivityService.getYieldStats(session.user.id, start, end),
        ActivityService.getPestDiseaseStats(session.user.id, start, end),
      ]);

    const analytics = {
      dashboard: {
        totalCrops: crops.length,
        activeTasks: taskStats.pending,
        overdueTasks: taskStats.overdue,
        recentHarvests: yieldStats.harvestCount,
        totalYield: yieldStats.totalYield,
        waterUsage: waterStats.totalWater,
      },
      water: waterStats,
      fertilizer: fertilizerStats,
      yield: yieldStats,
      pestDisease: pestStats,
      crops: crops.map((crop) => ({
        id: crop.id,
        name: crop.name,
        status: crop.status,
        plantingDate: crop.plantingDate,
        expectedHarvestDate: crop.expectedHarvestDate,
      })),
    };

    return NextResponse.json({
      success: true,
      data: analytics,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Error fetching analytics:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Internal server error",
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}
