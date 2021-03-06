import { moment } from 'meteor/momentjs:moment';
import { Template } from 'meteor/templating';
import { Router } from 'meteor/iron:router';
import './home.html';

Template.home.onRendered(function() {

  const latude = 29.721; // Houston
  const lngtude = -95.3443;

  var AQmap = L.map('displayMap', { doubleClickZoom: false });

  Router.current().data().forEach((site) => {
    const marker = L.marker([site.loc.coordinates[1], site.loc.coordinates[0]], { title: site.siteName });
    marker.aqsid = site.AQSID;
    marker.addTo(AQmap).on('click', onClick);
  });

  $('#displayMap').css('height', $('.col-md-6').height() * 2);
  $('#displayMap').css('width', $('.col-md-6').width());
  L.Icon.Default.imagePath = 'packages/bevanhunt_leaflet/images';

  AQmap.setView([
    latude, lngtude
  ], 9);

  L.tileLayer.provider('Esri.WorldStreetMap').addTo(AQmap);
});

Template.pushStatusCell.helpers({
  pushTimeStamp() {
    if (this.item.TCEQPushing === 'Active') {
      return moment.unix(this.item.lastPushEpoch).format('YYYY/MM/DD HH:mm');
    }
    return 'Push turned off';
  },
  isActualPush() {
    const checkEpoch = moment().subtract(1, 'days').unix();
    if (this.item.lastPushEpoch > checkEpoch || this.item.TCEQPushing === 'Inactive') {
      return true;
    }
    return false;
  },
  HNETGroup() {
    if (this.item.siteGroup === 'HNET') {
      return true;
    }
    return false;
  }
});

function onClick(e) {
  Router.go(`/site/${e.target.aqsid}`);
}
