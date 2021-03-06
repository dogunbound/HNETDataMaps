import { Meteor } from "meteor/meteor";
import { _ } from "meteor/underscore";
import { check, Match } from "meteor/check";
import { Promise } from "meteor/promise";
import { AggrData } from "../../collections_server";
import { flagsHash, colorsHash } from "../../constants";
import { LiveSites } from "../../collections_server";

// aggregation bc2 data to be plotted with highstock
Meteor.publish("bc2DataSeries", function (siteName, startEpoch, endEpoch) {
  check(siteName, String);
  check(startEpoch, Match.Integer);
  check(endEpoch, Match.Integer);
  const subscription = this;
  const bc2siteData = {};
  const aggBc2Pipe = [
    {
      $match: {
        $and: [
          { site: siteName },
          {
            epoch: {
              $gt: parseInt(startEpoch, 10),
              $lt: parseInt(endEpoch, 10),
            },
          },
        ],
      },
    },
    {
      $sort: {
        epoch: -1,
      },
    },
    {
      $group: {
        _id: { subTypes: "$subTypes", epoch: "$epoch" },
      },
    },
  ];

  // create new structure for bc2 data series to be used for charts
  const results = Promise.await(
    AggrData.rawCollection()
      .aggregate(aggBc2Pipe, { allowDiskUse: true })
      .toArray()
  );

  let modifiedData = {};
  const allSites = LiveSites.find({});
  // Initialize vars to measure individual function performance profiling across BC2 site 
  var timeForInstrumentSegregation = 0
  var timeForDataModification = 0
  var timeForRedBlueGreenOrganisation = 0
  var timeForSAEorganisation = 0
  var timeForAAEorganisation = 0
  var timeForCOorganisation = 0
  var timeForBC2ChartSubscription = 0

  // Initialize constant to measure current UNIX epoch
  const timeForWholeBC2chartOrganisationStart = Date.now()
  
  // BC2 chart data organisation begins here
  if (results.length > 0) {
    results.forEach((line) => {
      const epoch = line._id.epoch;
      _.each(line._id.subTypes, (data, instrument) => {
        _.each(data, (points, measurement) => {
          // sub is the array with metric/val pairs as subarrays, measurement, WS etc.
          if (_.last(points).val === 1) {
            let chart = measurement.toUpperCase();

            // Initialize constant to measure current UNIX epoch
            const timeForInstrumentSegregationStart = Date.now()

            if (instrument.includes("Neph")) {
              if (chart.includes("BACK")) {
                chart = `${instrument} Back Scattering`
              } else if (chart.includes("SAE")) {
                chart = `SAE`
              } else {
                chart = `${instrument} Scattering`
              }
            }
            if (instrument.includes("tap")) {
              if (chart.includes("ABSCOEF")) {
                chart = `${instrument.substring(0, 3)} Absolute Coefficients`
              } else if (chart.includes("SSA")) {
                chart = `SSA`
              } else if (chart.includes("AAE")) {
                chart = `${chart}`
              } else {
                chart = ``
              }
            }
            // Increment the var with subtracted UNIX epochs to get the final execution time
            timeForInstrumentSegregation = timeForInstrumentSegregation + (Date.now() - timeForInstrumentSegregationStart)
            
            if (chart !== ``) {
              // Initialize constant to measure current UNIX epoch
              const timeForDataModificationStart = Date.now()

              if (!bc2siteData[chart]) {
                // create placeholder for measurement
                bc2siteData[chart] = {};
              }
              if (!bc2siteData[chart][measurement]) {
                // create placeholder for series if not exists
                bc2siteData[chart][measurement] = [];
              }
              // get all measurements where flag == 1
              if (modifiedData[epoch * 1000]) {
                modifiedData[epoch * 1000] = {
                  ...modifiedData[epoch * 1000],
                  [instrument]: {
                    [measurement]: points[1],
                  },
                };
              } else {
                modifiedData[epoch * 1000] = {
                  [instrument]: {
                    [measurement]: points[1],
                  },
                };
              }
              // Increment the var with subtracted UNIX epochs to get the final execution time
              timeForDataModification = timeForDataModification + (Date.now() - timeForDataModificationStart)

              if (points[1].val) {
                // Initialize constant to measure current UNIX epoch
                const timeForRedBlueGreenOrganisationStart = Date.now()

                if (measurement.includes("Red")) {
                  if (chart.includes("SSA")) {
                    modifiedData = {
                      x: epoch * 1000, // milliseconds
                      y: points[0].val, // average
                      color: colorsHash[1].color,
                    };  
                  } else {
                    modifiedData = {
                      x: epoch * 1000, // milliseconds
                      y: points[1].val, // average
                      color: colorsHash[1].color,
                    };  
                  }
                } else if (measurement.includes("Blue")) {
                  if (chart.includes("SSA")) {
                    modifiedData = {
                      x: epoch * 1000, // milliseconds
                      y: points[0].val, // average
                      color: colorsHash[2].color,
                    };  
                  } else {
                    modifiedData = {
                      x: epoch * 1000, // milliseconds
                      y: points[1].val, // average
                      color: colorsHash[2].color,
                    };  
                  }
                } else if (measurement.includes("Green")) {
                  if (chart.includes("SSA")) {
                    modifiedData = {
                      x: epoch * 1000, // milliseconds
                      y: points[0].val, // average
                      color: colorsHash[3].color,
                    };  
                  } else {
                    modifiedData = {
                      x: epoch * 1000, // milliseconds
                      y: points[1].val, // average
                      color: colorsHash[3].color,
                    };  
                  }
                  // Increment the var with subtracted UNIX epochs to get the final execution time
                  timeForRedBlueGreenOrganisation = timeForRedBlueGreenOrganisation + (Date.now() - timeForRedBlueGreenOrganisationStart)
                } else if (chart.includes("SAE")) { 
                  // Initialize constant to measure current UNIX epoch
                  const timeForSAEorganisationStart = Date.now()

                  let threshold      // initializing threshold
                  let bounds         // initializing bounds
                  allSites.forEach((site) => {
                    _.each(site.Channels, (subChannels) => {
                      _.each(subChannels, (subData) => {
                        if (typeof subChannels.Threshold !== "undefined") { // does not loop if you have undefined thresholds
                          if (subChannels.Name === chart) {
                            threshold = subChannels.Threshold.Value
                            bounds = subChannels.Threshold.Bounds
                          }
                        }
                      });
                    });
                    if(bounds == "Lesser"){
                      if (points[0].val < threshold) {     // compare datapoint with threshold
                        modifiedData = {
                          x: epoch * 1000, // milliseconds
                          y: points[0].val, // average
                          color: colorsHash[5].color, // biomass burning color
                        };
                      }
                      else {
                        modifiedData = {
                          x: epoch * 1000, // milliseconds
                          y: points[0].val, // average
                          color: colorsHash[4].color,
                        };
                      }
                    } else {
                      if (points[0].val > threshold) {     // compare datapoint with threshold
                        modifiedData = {
                          x: epoch * 1000, // milliseconds
                          y: points[0].val, // calc
                          color: colorsHash[4].color,
                        };
                      }
                      else {
                        modifiedData = {
                          x: epoch * 1000, // milliseconds
                          y: points[0].val, // calc
                          color: colorsHash[4].color,
                        };
                      }
                    }
                  });
                  // Increment the var with subtracted UNIX epochs to get the final execution time
                  timeForSAEorganisation = timeForSAEorganisation + (Date.now() - timeForSAEorganisationStart)
                } else if (measurement.includes("AAE")) {
                  // Initialize constant to measure current UNIX epoch
                  const timeForAAEorganisationStart = Date.now()

                  let threshold      // initializing threshold
                  let bounds         // initializing bounds
                  allSites.forEach((site) => {
                    _.each(site.Channels, (subChannels) => {
                      _.each(subChannels, (subData) => {
                        if (typeof subChannels.Threshold !== "undefined") { // does not loop if you have undefined thresholds
                          if (subChannels.Name === chart) {
                            threshold = subChannels.Threshold.Value
                            bounds = subChannels.Threshold.Bounds
                          }
                        }
                      });
                    });
                    if(bounds == "Lesser"){
                      if (points[0].val < threshold) {     // compare datapoint with threshold
                        modifiedData = {
                          x: epoch * 1000, // milliseconds
                          y: points[0].val, // calc
                          color: colorsHash[4].color,
                        };
                      }
                      else {
                        modifiedData = {
                          x: epoch * 1000, // milliseconds
                          y: points[0].val, // calc
                          color: colorsHash[4].color,
                        };
                      }
                    } else {
                      if (points[0].val > threshold) {     // compare datapoint with threshold
                        modifiedData = {
                          x: epoch * 1000, // milliseconds
                          y: points[0].val, // calc
                          color: colorsHash[6].color,
                        };
                      }
                      else {
                        modifiedData = {
                          x: epoch * 1000, // milliseconds
                          y: points[0].val, // calc
                          color: colorsHash[4].color,
                        };
                      }
                    }
                  });
                  // Increment the var with subtracted UNIX epochs to get the final execution time
                  timeForAAEorganisation = timeForAAEorganisation + (Date.now() - timeForAAEorganisationStart)
                } else if (measurement.includes("CO")) {
                  // Initialize constant to measure current UNIX epoch
                  const timeForCOorganisationStart = Date.now()

                  modifiedData = {
                    x: epoch * 1000, // milliseconds
                    y: points[1].val, // average
                    color: colorsHash[4].color, // red color
                  };
                  // Increment the var with subtracted UNIX epochs to get the final execution time
                  timeForCOorganisation = timeForCOorganisation + (Date.now() - timeForCOorganisationStart)
                }
              }
              bc2siteData[chart][measurement].push(modifiedData);
            }
          }
        });
      });
    });
  }
  // console.log('Time for whole BC2 chart Organisation: ', Date.now() - timeForWholeBC2chartOrganisationStart, 'milliseconds')
  // console.log('Time for Instrument Segregation: ', timeForInstrumentSegregation, 'milliseconds')
  // console.log('Time for Data Modification: ', timeForDataModification, 'milliseconds')
  // console.log('Time for Red Blue Green Organisation: ', timeForRedBlueGreenOrganisation, 'milliseconds')
  // console.log('Time for SAE Organisation: ', timeForSAEorganisation, 'milliseconds')
  // console.log('Time for AAE Organisation: ', timeForAAEorganisation, 'milliseconds')
  // console.log('Time for CO Organisation', timeForCOorganisation, 'milliseconds')

  Object.keys(bc2siteData).forEach((chart) => {
  // Initialize constant to measure current UNIX epoch
  const timeForBC2ChartSubscriptionStart = Date.now()

    if (Object.prototype.hasOwnProperty.call(bc2siteData, chart)) {
      const chartSeries = { charts: [] };
      Object.keys(bc2siteData[chart]).forEach((measurment) => {
        if (
          Object.prototype.hasOwnProperty.call(bc2siteData[chart], measurment)
        ) {
          const dataSorted = bc2siteData[chart][measurment].sort(
            (obj1, obj2) => {
              // Ascending: sorting by epoch?
              return obj1.x - obj2.x;
            }
          );
          const series = {
            name: measurment,
            type: "scatter",
            marker: {
              enabled: true,
              radius: 2,
              symbol: "circle",
            },
            data: dataSorted,
          };
          chartSeries.charts.push(series);
        }
      });

      subscription.added("bc2DataSeries", chart, chartSeries);
    }
    // Increment the var with subtracted UNIX epochs to get the final execution time
    timeForBC2ChartSubscription = timeForBC2ChartSubscription + (Date.now() - timeForBC2ChartSubscriptionStart)
  });
  // console.log('Time for BC2 Chart Subscription: ', timeForBC2ChartSubscription, 'milliseconds', '\n')
  this.ready();
});
