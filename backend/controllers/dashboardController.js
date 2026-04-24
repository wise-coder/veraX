const { getDashboardOverviewData } = require("../utils/systemHelpers");

const getDashboardOverview = async (req, res, next) => {
  try {
    const overview = await getDashboardOverviewData(req.companyId);

    return res.json({
      success: true,
      message: "Dashboard overview fetched successfully",
      data: overview,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getDashboardOverview,
};
