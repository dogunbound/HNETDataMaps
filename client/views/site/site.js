import Highcharts from 'highcharts/highstock';

// 24 hours ago - seconds
var startEpoch = new ReactiveVar(moment().subtract(1439, 'minutes').unix());
var endEpoch = new ReactiveVar(moment().unix());
var selectedFlag = new ReactiveVar(null);

Meteor.subscribe('sites');

Highcharts.setOptions({
  global: {
    useUTC: false,
  },
});

// pass null as collection name, it will create
// local only collection
const EditPoints = new Mongo.Collection(null);

// placeholder for dynamic chart containers
var Charts = new Meteor.Collection(null);

/**
 * Custom selection handler that selects points and cancels the default zoom behaviour
 */
function selectPointsByDrag(e) {
  var selection = [];
  // Select points only for series where allowPointSelect
  Highcharts.each(this.series, function(series) {
    if (series.options.allowPointSelect === 'true' && series.name !== 'Navigator') {
      Highcharts.each(series.points, function(point) {
        if (point.x >= e.xAxis[0].min && point.x <= e.xAxis[0].max) {
          // point.select(true, true);
          selection.push(point);
        }
      });
    }
  });

  // Fire a custom event
  Highcharts.fireEvent(this, 'selectedpoints', {
    // points: this.getSelectedPoints
    points: selection
  });

  return false; // Don't zoom
}

/**
 * The handler for a custom event, fired from selection event
 */
function selectedPoints(e) {
  var points = [];
  _.each(e.points, function(point) {
    if (point.series.name !== 'Navigator') {
      const selectedPoint = {};
      selectedPoint.x = point.x;
      selectedPoint.y = point.y;
      selectedPoint.flag = flagsHash[point.name];
      selectedPoint.site = Router.current().params._id;
      selectedPoint.instrument = point.series.chart.title.textStr;
      selectedPoint.measurement = point.series.name;
      selectedPoint.id = point.series.chart.title.textStr + '_' + point.series.name + '_' + point.x;
      point.id = selectedPoint.id;
      points.push(selectedPoint);
    }
  });

  if (points.length === 0) return;

  EditPoints.remove({});
  for (let i = 0; i < points.length; i++) {
    EditPoints.insert(points[i]);
  }

  // Show the Edit Points modal
  $('#editPointsModal').modal({}).modal('show');

  $('#btnSubmit').click(function(event) {
    // update the edited points with the selected flag on the server
    const newFlagVal = flagsHash[selectedFlag.get()].val;
    const updatedPoints = EditPoints.find({});
    updatedPoints.forEach(function(point) {
      Meteor.call('insertUpdateFlag', point.site, point.x, point.instrument, point.measurement, newFlagVal);
    });
    // Update local point color to reflect new flag
    e.points.forEach((point) => {
      point.update({
        color: flagsHash[selectedFlag.get()].color,
      }, false);
    });
    // Redraw chart

    e.points[0].series.chart.redraw();
  });

  $('#editPointsModal table tr .fa').click(function(event) {
    // Get X value stored in the data-id attribute of the button
    const pointId = $(event.currentTarget).data('id');

    // Query the local selected points db for that point, and remove it
    // This triggers a reactive render of the EditPoints
    EditPoints.remove({
      id: pointId,
    });

    // Also remove the point from the HighCharts selection
    // (so it doesn't change color temporarily on approval)
    for (let i = 0; i < e.points.length; i++) {
      const p = e.points[i];
      if (p.id === pointId) {
        p.select(false);
        e.points.splice(i, 1);
        break;
      }
    }
  });
}

/**
 * On click, unselect all points
 */
function unselectByClick() {
  var points = this.getSelectedPoints();
  if (points.length > 0) {
    Highcharts.each(points, function(point) {
      point.select(false);
    });
  }
}

/**
 * Create highstock based chart.
 */
function createChart(chartName, titleText, seriesOptions, yAxisOptions) {
  const mychart = new Highcharts.StockChart({
    exporting: {
      enabled: true,
    },
    chart: {
      events: {
        selection: selectPointsByDrag,
        selectedpoints: selectedPoints,
        click: unselectByClick
      },
      zoomType: 'xy',
      renderTo: chartName,
    },
    title: {
      text: titleText,
    },
    xAxis: {
      type: 'datetime',
      title: {
        text: 'Local Time',
      },
			minRange: 3600 * 1000 +10,
    },
    yAxis: yAxisOptions,
    series: seriesOptions,
    tooltip: {
      enabled: true,
      crosshairs: [true],
      positioner(labelWidth, labelHeight, point) {
        let tooltipX;
        let tooltipY;
        if (point.plotX + this.chart.plotLeft < labelWidth && point.plotY + labelHeight > this.chart.plotHeight) {
          tooltipX = this.chart.plotLeft;
          tooltipY = this.chart.plotTop + this.chart.plotHeight - 2 * labelHeight - 10;
        } else {
          tooltipX = this.chart.plotLeft;
          tooltipY = this.chart.plotTop + this.chart.plotHeight - labelHeight;
        }
        return {
          x: tooltipX,
          y: tooltipY,
        };
      },
      formatter() {
        let s = moment(this.x).format('YYYY/MM/DD HH:mm:ss');
        s += '<br/>' + this.series.name + ' <b>' + this.y.toFixed(2) + '</b>';
        return s;
      },
      shared: false,
    },
    credits: {
      enabled: false,
    },
    legend: {
      enabled: true,
      align: 'right',
      layout: 'vertical',
      verticalAlign: 'top',
      y: 100,
    },
    rangeSelector: {
      inputEnabled: false,
      allButtonsEnabled: true,
      buttons: [{
        type: 'minute',
        count: 60,
        text: 'Hour',
        dataGrouping: {
          forced: true,
          units: [
            ['hour', [60]],
          ],
        },
      }, {
        type: 'all',
        count: 1,
        text: '1 Day',
        dataGrouping: {
          forced: true,
          units: [
            ['day', [1]],
          ],
        },
      }],
      buttonTheme: {
        width: 60,
      },
      selected: 1,
    }
  });
}

Template.site.onRendered(function() {
  // Do reactive stuff when something is added or removed
  this.autorun(function() {
    console.log('site: ', Router.current().params._id, 'start: ', startEpoch.get(), 'end: ', endEpoch.get());

    // Subscribe
    Meteor.subscribe('dataSeries', Router.current().params._id,
      startEpoch.get(), endEpoch.get());
    Charts.remove({});
    var query = DataSeries.find();
    var handle = query.observeChanges({
      added: function(series, seriesData) {
        console.log(`series add: ${series}`);
        const subType = series.split(/[_]+/)[0];

        // store yAxis options in separate variable
        let yAxisOptions = seriesData.yAxis;
        delete seriesData['yAxis'];

        // insert object into Charts if not yet exists and create new chart
        if (!Charts.findOne({
            id: subType
          }, {
            reactive: false
          })) {
          Charts.insert({
            id: subType,
          });

          const seriesOptions = [];
          seriesOptions.push(seriesData);
          createChart(`container-chart-${subType}`, subType, seriesOptions, yAxisOptions);
        } else {

          // put axis for each series
          const chart = $(`#container-chart-${subType}`).highcharts();

          if (chart.series.length === 2 && seriesData.chartType === 'scatter') { // Secondary yAxis
            yAxisOptions.opposite = true;
            yAxisOptions.id = subType;
            chart.addAxis(
              yAxisOptions
            );
          }

          if (seriesData.chartType !== 'line' && chart.series.length !== 2) {
            seriesData.yAxis = subType;
          }

          chart.addSeries(seriesData);
        }
      },
    });
  }); // end autorun
}); // end of onRendered

Template.editPoints.events({
  'click .dropdown-menu li a' (event) {
    event.preventDefault();
    selectedFlag.set(parseInt($(event.currentTarget).attr('data-value'), 10));
  },
});

Template.editPoints.helpers({
  points() {
    return EditPoints.find({});
  },
  availableFlags() {
    return _.where(flagsHash, {
      selectable: true,
    });
  },
  flagSelected() {
    return flagsHash[selectedFlag.get()];
  },
  numFlagsWillChange() {
    const newFlag = selectedFlag.get();
    if (newFlag === null || isNaN(newFlag)) {
      return 0;
    }
    return EditPoints.find({
      'flag.val': {
        $not: newFlag,
      },
    }).count();
  },
  numPointsSelected() {
    return EditPoints.find().count();
  },
  formatDataValue(val) {
    return val.toFixed(3);
  },
  isValid() {
    var validFlagSet = _.pluck(_.where(flagsHash, {
      selectable: true,
    }), 'val');
    return _.contains(validFlagSet, selectedFlag.get());
  },
});

Template.registerHelper('formatDate', function(epoch) {
  return moment(epoch).format('YYYY/MM/DD HH:mm:ss');
});

Template.site.helpers({
  sitename() {
    const site = Sites.findOne({
      AQSID: Router.current().params._id,
    });
    return site['site name'];
  },
  selectedDate() {
    return moment.unix(endEpoch.get()).format('YYYY-MM-DD');
  },
  charts() {
    return Charts.find(); // This gives data to the html below
  },
});

Template.site.events({
  'change #datepicker' (event) {
    startEpoch.set(moment(event.target.value, 'YYYY-MM-DD').unix());
    endEpoch.set(moment.unix(startEpoch.get()).add(1439, 'minutes').unix());
  },
  'click #createPush' () {
    DataExporter.exportForTCEQ(Router.current().params._id, startEpoch.get(), endEpoch.get());
  },
  'click #updateAggr' () {
    Meteor.call('new5minAggreg', Router.current().params._id,
      startEpoch.get(), endEpoch.get(),
      function(err, response) {
        if (err) {
          Session.set('serverDataResponse', `Error: ${err.reason}`);
          return;
        }
        Session.set('serverDataResponse', response);
      });
  },
});
