import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:image_picker/image_picker.dart';
import 'package:video_player/video_player.dart';
import 'package:intl/intl.dart';

import '../../../branches/presentation/providers/branches_providers.dart';
import '../../../brands/presentation/providers/brands_providers.dart';
import '../../domain/entities/offer.dart';
import '../providers/offers_providers.dart';

const _offerTypes = ['PERCENTAGE', 'FLAT', 'BUY_ONE_GET_ONE', 'FREE_ITEM', 'BUNDLE'];
const _statuses = ['DRAFT', 'PUBLISHED', 'PAUSED', 'EXPIRED', 'ARCHIVED'];
const _benefitTypes = ['Cashback', 'Discount', 'No-cost EMI', 'Extra Off', 'Reward Points'];

class OfferEditScreen extends ConsumerStatefulWidget {
  const OfferEditScreen({super.key, this.offerId, this.initialBrandId});
  final String? offerId;
  final String? initialBrandId;

  @override
  ConsumerState<OfferEditScreen> createState() => _OfferEditScreenState();
}

class _OfferEditScreenState extends ConsumerState<OfferEditScreen> {
  // Selection / branch context
  String? _brandId;
  String? _branchId;

  // Form controllers
  final _title = TextEditingController();
  final _description = TextEditingController();
  String _offerType = 'PERCENTAGE';
  final _discountValue = TextEditingController(text: '10');
  final _maxDiscount = TextEditingController();
  final _minPurchase = TextEditingController();
  final _coupon = TextEditingController();
  DateTime _startsAt = DateTime.now();
  DateTime _expiresAt = DateTime.now().add(const Duration(days: 30));
  String _status = 'DRAFT';
  final _tags = TextEditingController();

  final List<String> _images = [];
  String? _listImage;
  String? _videoUrl;

  final List<CardOffer> _cardOffers = [];
  String? _pickBankId;
  String? _pickCardId;

  final List<OfferPlatform> _platforms = [];

  bool _saving = false;
  bool _loading = false;
  String? _error;

  bool get isEdit => widget.offerId != null;

  @override
  void initState() {
    super.initState();
    _brandId = widget.initialBrandId;
    if (isEdit) _loadOffer();
  }

  @override
  void dispose() {
    for (final c in [_title, _description, _discountValue, _maxDiscount, _minPurchase, _coupon, _tags]) {
      c.dispose();
    }
    super.dispose();
  }

  Future<void> _loadOffer() async {
    setState(() => _loading = true);
    try {
      final o = await ref.read(offersRepositoryProvider).getById(widget.offerId!);
      _branchId = o.branchId;
      _title.text = o.title;
      _description.text = o.description ?? '';
      _offerType = o.offerType;
      _discountValue.text = o.discountValue.toString();
      _maxDiscount.text = o.maxDiscountAmount?.toString() ?? '';
      _minPurchase.text = o.minPurchaseAmount?.toString() ?? '';
      _coupon.text = o.couponCode ?? '';
      _startsAt = o.startsAt;
      _expiresAt = o.expiresAt;
      _status = o.status;
      _tags.text = o.tags.join(', ');
      _images
        ..clear()
        ..addAll(o.images);
      _listImage = o.listImage;
      _videoUrl = o.videoUrl;
      _cardOffers
        ..clear()
        ..addAll(o.cardOffers);
      _platforms
        ..clear()
        ..addAll(o.platforms);
    } catch (e) {
      if (mounted) setState(() => _error = '$e');
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _pickDate({required bool start}) async {
    final initial = start ? _startsAt : _expiresAt;
    final picked = await showDatePicker(
      context: context,
      initialDate: initial,
      firstDate: DateTime(2020),
      lastDate: DateTime(2100),
    );
    if (picked != null) {
      setState(() {
        if (start) _startsAt = picked;
        else _expiresAt = picked;
      });
    }
  }

  /// Pick & upload a single XFile, return the stored URL.
  Future<String?> _uploadXFile(XFile file) async {
    final bytes = await file.readAsBytes();
    return ref.read(offersRepositoryProvider).uploadFile(
          bytes: bytes,
          filename: file.name.isNotEmpty ? file.name : 'upload',
        );
  }

  /// Ask the user: Camera or Gallery? Returns null if dismissed.
  /// Same UX for thumbnail / images / video — keeps the form predictable.
  Future<ImageSource?> _promptSource({required bool isVideo}) {
    return showModalBottomSheet<ImageSource>(
      context: context,
      builder: (ctx) => SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            ListTile(
              leading: const Icon(Icons.photo_camera_outlined),
              title: Text(isVideo ? 'Record a video' : 'Take a photo'),
              onTap: () => Navigator.of(ctx).pop(ImageSource.camera),
            ),
            ListTile(
              leading: const Icon(Icons.photo_library_outlined),
              title: Text(isVideo ? 'Choose video from gallery' : 'Choose from gallery'),
              onTap: () => Navigator.of(ctx).pop(ImageSource.gallery),
            ),
            const SizedBox(height: 4),
          ],
        ),
      ),
    );
  }

  /// Append one or more images to the gallery. Camera path captures a single
  /// shot (one tap = one photo); gallery path supports multi-select.
  Future<void> _pickGalleryImages() async {
    final source = await _promptSource(isVideo: false);
    if (source == null) return;
    final picker = ImagePicker();
    final List<XFile> files;
    if (source == ImageSource.camera) {
      final file = await picker.pickImage(source: ImageSource.camera, imageQuality: 85);
      if (file == null) return;
      files = [file];
    } else {
      files = await picker.pickMultiImage(imageQuality: 85);
      if (files.isEmpty) return;
    }
    setState(() => _saving = true);
    try {
      for (final f in files) {
        if (_images.length >= 10) break;
        final url = await _uploadXFile(f);
        if (url != null) setState(() => _images.add(url));
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text('Upload failed: $e')));
      }
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  /// Pick a single thumbnail (replaces the existing one). Camera or gallery.
  Future<void> _pickListThumbnail() async {
    final source = await _promptSource(isVideo: false);
    if (source == null) return;
    final picker = ImagePicker();
    final file = await picker.pickImage(source: source, imageQuality: 85);
    if (file == null) return;
    setState(() => _saving = true);
    try {
      final url = await _uploadXFile(file);
      if (url != null) setState(() => _listImage = url);
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text('Upload failed: $e')));
      }
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  /// Pick or record a single promo video (replaces the existing one). Camera
  /// path opens the OS camera in video mode; gallery path opens the picker.
  Future<void> _pickVideo() async {
    final source = await _promptSource(isVideo: true);
    if (source == null) return;
    final picker = ImagePicker();
    // ~60s ceiling avoids accidentally uploading multi-minute clips that
    // would slow the offer detail load on customers' phones.
    final file = await picker.pickVideo(
      source: source,
      maxDuration: const Duration(seconds: 60),
    );
    if (file == null) return;
    setState(() => _saving = true);
    try {
      final url = await _uploadXFile(file);
      if (url != null) setState(() => _videoUrl = url);
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text('Video upload failed: $e')));
      }
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  Future<void> _save() async {
    if (_branchId == null || _title.text.trim().isEmpty) {
      setState(() => _error = 'Pick a branch and enter a title.');
      return;
    }
    final dv = double.tryParse(_discountValue.text.trim());
    if (dv == null || dv <= 0) {
      setState(() => _error = 'Discount value must be a positive number.');
      return;
    }
    setState(() { _saving = true; _error = null; });
    try {
      final body = <String, dynamic>{
        'branchId': _branchId,
        'title': _title.text.trim(),
        if (_description.text.trim().isNotEmpty) 'description': _description.text.trim(),
        'offerType': _offerType,
        'discountValue': dv,
        if (_maxDiscount.text.trim().isNotEmpty)
          'maxDiscountAmount': double.tryParse(_maxDiscount.text.trim()),
        if (_minPurchase.text.trim().isNotEmpty)
          'minPurchaseAmount': double.tryParse(_minPurchase.text.trim()),
        if (_coupon.text.trim().isNotEmpty) 'couponCode': _coupon.text.trim(),
        'startsAt': DateFormat('yyyy-MM-dd').format(_startsAt),
        'expiresAt': DateFormat('yyyy-MM-dd').format(_expiresAt),
        'status': _status,
        'tags': _tags.text.split(',').map((t) => t.trim()).where((t) => t.isNotEmpty).take(15).toList(),
        'images': _images,
        if (_listImage != null) 'listImage': _listImage,
        if (_videoUrl != null) 'videoUrl': _videoUrl,
        'cardOffers': _cardOffers.map((c) => {
              'cardTypeId': c.cardTypeId,
              if (c.benefitType != null) 'benefitType': c.benefitType,
              if (c.benefitValue != null && c.benefitValue!.isNotEmpty)
                'benefitValue': c.benefitValue,
              if (c.minSpend != null) 'minSpend': c.minSpend,
              if (c.maxBenefit != null) 'maxBenefit': c.maxBenefit,
            }).toList(),
        'platforms': _platforms
            .where((p) => p.platformName.trim().isNotEmpty)
            .map((p) => {
                  'platformName': p.platformName.trim(),
                  if (p.url != null && p.url!.trim().isNotEmpty) 'url': p.url!.trim(),
                })
            .toList(),
      };
      final repo = ref.read(offersRepositoryProvider);
      if (isEdit) {
        body.remove('branchId');
        await repo.update(widget.offerId!, body);
      } else {
        await repo.create(body);
      }
      if (_brandId != null) {
        ref.invalidate(offersForBrandProvider(_brandId!));
      }
      if (mounted) Navigator.of(context).pop(true);
    } catch (e) {
      if (mounted) setState(() => _error = '$e');
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final brands = ref.watch(myBrandsProvider);
    final banks = ref.watch(bankCatalogProvider);
    // Compact "30 Jun 2026" — leaves room in the side-by-side date buttons
    // on narrow phones (the previous "yyyy-MM-dd" + "Starts: " prefix
    // overflowed the available Row width).
    final df = DateFormat('d MMM yyyy');
    return Scaffold(
      appBar: AppBar(
        title: Text(isEdit ? 'Edit offer' : 'New offer'),
        actions: [
          TextButton(
            onPressed: _saving ? null : _save,
            child: _saving
                ? const SizedBox(
                    height: 16, width: 16, child: CircularProgressIndicator(strokeWidth: 2))
                : Text(isEdit ? 'Save' : 'Create'),
          ),
        ],
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : ListView(
              padding: const EdgeInsets.fromLTRB(16, 12, 16, 64),
              children: [
                // ── Brand / branch ──
                brands.maybeWhen(
                  data: (bs) => DropdownButtonFormField<String>(
                    value: _brandId,
                    decoration: const InputDecoration(labelText: 'Brand *'),
                    items: bs.map((b) =>
                        DropdownMenuItem(value: b.id, child: Text(b.name))).toList(),
                    onChanged: isEdit
                        ? null
                        : (v) => setState(() {
                              _brandId = v;
                              _branchId = null;
                            }),
                  ),
                  orElse: () => const LinearProgressIndicator(),
                ),
                const SizedBox(height: 8),
                if (_brandId != null)
                  Consumer(builder: (_, ref, __) {
                    final branches = ref.watch(branchesForBrandProvider(_brandId!));
                    return branches.maybeWhen(
                      data: (bs) => DropdownButtonFormField<String>(
                        value: bs.any((x) => x.id == _branchId) ? _branchId : null,
                        decoration: const InputDecoration(labelText: 'Branch *'),
                        items: bs.map((b) =>
                            DropdownMenuItem(value: b.id, child: Text(b.name))).toList(),
                        onChanged: (v) => setState(() => _branchId = v),
                      ),
                      orElse: () => const LinearProgressIndicator(),
                    );
                  }),
                const SizedBox(height: 16),

                // ── Core fields ──
                TextField(
                  controller: _title,
                  decoration: const InputDecoration(labelText: 'Title *'),
                  textCapitalization: TextCapitalization.sentences,
                ),
                const SizedBox(height: 8),
                TextField(
                  controller: _description,
                  maxLines: 3,
                  decoration: const InputDecoration(labelText: 'Description'),
                ),
                const SizedBox(height: 8),
                Row(children: [
                  Expanded(
                    child: DropdownButtonFormField<String>(
                      value: _offerType,
                      decoration: const InputDecoration(labelText: 'Type *'),
                      items: _offerTypes
                          .map((t) => DropdownMenuItem(value: t, child: Text(t.replaceAll('_', ' '))))
                          .toList(),
                      onChanged: (v) => setState(() => _offerType = v ?? 'PERCENTAGE'),
                    ),
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: TextField(
                      controller: _discountValue,
                      keyboardType: const TextInputType.numberWithOptions(decimal: true),
                      decoration: const InputDecoration(labelText: 'Discount value *'),
                    ),
                  ),
                ]),
                const SizedBox(height: 8),
                Row(children: [
                  Expanded(
                    child: TextField(
                      controller: _maxDiscount,
                      keyboardType: TextInputType.number,
                      decoration: const InputDecoration(labelText: 'Max discount ₹'),
                    ),
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: TextField(
                      controller: _minPurchase,
                      keyboardType: TextInputType.number,
                      decoration: const InputDecoration(labelText: 'Min purchase ₹'),
                    ),
                  ),
                ]),
                const SizedBox(height: 8),
                TextField(
                  controller: _coupon,
                  decoration: const InputDecoration(labelText: 'Coupon code'),
                ),
                const SizedBox(height: 12),

                // ── Dates ──
                Row(children: [
                  Expanded(
                    child: OutlinedButton.icon(
                      onPressed: () => _pickDate(start: true),
                      icon: const Icon(Icons.calendar_today, size: 16),
                      // Flexible + ellipsis is needed because *Button.icon
                      // doesn't shrink its label otherwise — long date
                      // strings would push past the Expanded width and
                      // RenderFlex would overflow on narrow phones.
                      label: Flexible(
                        child: Text(
                          'Starts: ${df.format(_startsAt)}',
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                        ),
                      ),
                    ),
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: OutlinedButton.icon(
                      onPressed: () => _pickDate(start: false),
                      icon: const Icon(Icons.event_available, size: 16),
                      label: Flexible(
                        child: Text(
                          'Ends: ${df.format(_expiresAt)}',
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                        ),
                      ),
                    ),
                  ),
                ]),
                const SizedBox(height: 12),
                DropdownButtonFormField<String>(
                  value: _status,
                  decoration: const InputDecoration(labelText: 'Status'),
                  items: _statuses
                      .map((s) => DropdownMenuItem(value: s, child: Text(s)))
                      .toList(),
                  onChanged: (v) => setState(() => _status = v ?? 'DRAFT'),
                ),
                const SizedBox(height: 8),
                TextField(
                  controller: _tags,
                  decoration: const InputDecoration(
                    labelText: 'Tags',
                    hintText: 'comma,separated,tags',
                  ),
                ),
                const Divider(height: 32),

                // ── List thumbnail (single) ──
                // Goes first because it's what the seller chooses as the
                // "face" of the offer in lists/cards — easiest to think about
                // before deciding which detail-page images to upload.
                Row(children: [
                  Expanded(
                    child: Text('List thumbnail',
                        style: Theme.of(context).textTheme.titleSmall),
                  ),
                  TextButton.icon(
                    onPressed: _saving ? null : _pickListThumbnail,
                    icon: const Icon(Icons.image_outlined),
                    label: Text(_listImage == null ? 'Add' : 'Replace'),
                  ),
                ]),
                Text('Shown on offer cards in lists/grids. Detail page is unaffected.',
                    style: Theme.of(context).textTheme.bodySmall),
                const SizedBox(height: 6),
                if (_listImage != null)
                  Stack(children: [
                    GestureDetector(
                      onTap: () => _openImageViewer([_listImage!], 0),
                      child: ClipRRect(
                        borderRadius: BorderRadius.circular(8),
                        child: SizedBox(
                          width: double.infinity,
                          height: 180,
                          child: Image.network(_listImage!, fit: BoxFit.cover,
                            errorBuilder: (_, __, ___) => Container(
                              height: 180, color: Colors.grey.shade300,
                              child: const Icon(Icons.broken_image),
                            ),
                          ),
                        ),
                      ),
                    ),
                    Positioned(
                      top: 6, right: 6,
                      child: GestureDetector(
                        onTap: () => setState(() => _listImage = null),
                        child: const CircleAvatar(radius: 14,
                            backgroundColor: Colors.black54,
                            child: Icon(Icons.close, size: 16, color: Colors.white)),
                      ),
                    ),
                    const Positioned(
                      bottom: 6, right: 6,
                      child: _TapToZoomHint(),
                    ),
                  ]),
                const SizedBox(height: 16),

                // ── Images (multi-upload) ──
                Row(children: [
                  Expanded(
                    child: Text('Images (${_images.length}/10)',
                        style: Theme.of(context).textTheme.titleSmall),
                  ),
                  TextButton.icon(
                    onPressed: (_saving || _images.length >= 10) ? null : _pickGalleryImages,
                    icon: const Icon(Icons.add_photo_alternate_outlined),
                    label: const Text('Add images'),
                  ),
                ]),
                if (_images.isNotEmpty) ...[
                  const SizedBox(height: 4),
                  SizedBox(
                    // Bigger tiles so the seller can actually see what they
                    // uploaded; tap any tile to view full size + swipe between.
                    height: 140,
                    child: ListView.separated(
                      scrollDirection: Axis.horizontal,
                      itemCount: _images.length,
                      separatorBuilder: (_, __) => const SizedBox(width: 8),
                      itemBuilder: (_, i) => Stack(children: [
                        GestureDetector(
                          onTap: () => _openImageViewer(_images, i),
                          child: ClipRRect(
                            borderRadius: BorderRadius.circular(8),
                            child: Image.network(_images[i],
                                width: 140, height: 140, fit: BoxFit.cover,
                                errorBuilder: (_, __, ___) => Container(
                                      width: 140, height: 140, color: Colors.grey.shade300,
                                      child: const Icon(Icons.broken_image),
                                    )),
                          ),
                        ),
                        Positioned(
                          top: 4, right: 4,
                          child: GestureDetector(
                            onTap: () => setState(() => _images.removeAt(i)),
                            child: const CircleAvatar(radius: 12,
                                backgroundColor: Colors.black54,
                                child: Icon(Icons.close, size: 14, color: Colors.white)),
                          ),
                        ),
                        Positioned(
                          left: 4, bottom: 4,
                          child: Container(
                            padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                            decoration: BoxDecoration(
                              color: Colors.black.withValues(alpha: 0.55),
                              borderRadius: BorderRadius.circular(999),
                            ),
                            child: Text('${i + 1}',
                                style: const TextStyle(color: Colors.white, fontSize: 11, fontWeight: FontWeight.w600)),
                          ),
                        ),
                      ]),
                    ),
                  ),
                ],
                const SizedBox(height: 16),

                // ── Promo video (single, optional) ──
                Row(children: [
                  Expanded(
                    child: Text('Promo video',
                        style: Theme.of(context).textTheme.titleSmall),
                  ),
                  TextButton.icon(
                    onPressed: _saving ? null : _pickVideo,
                    icon: const Icon(Icons.movie_outlined),
                    label: Text(_videoUrl == null ? 'Add video' : 'Replace video'),
                  ),
                ]),
                Text('Optional MP4/WebM/MOV. Shown on the offer detail page.',
                    style: Theme.of(context).textTheme.bodySmall),
                const SizedBox(height: 6),
                if (_videoUrl != null)
                  // Inline player so the seller can confirm the upload looks
                  // right before saving the offer.
                  _VideoPreviewTile(
                    url: _videoUrl!,
                    onRemove: () => setState(() => _videoUrl = null),
                  ),
                const Divider(height: 32),

                // ── Card offers ──
                Text('Card offers', style: Theme.of(context).textTheme.titleSmall),
                const SizedBox(height: 8),
                banks.when(
                  loading: () => const LinearProgressIndicator(),
                  error: (e, _) => Text('Could not load banks: $e'),
                  data: (allBanks) {
                    final selectedBank = allBanks.firstWhere(
                      (b) => b.id == _pickBankId,
                      orElse: () => const BankCatalog(id: '', name: '', slug: '', cards: []),
                    );
                    final taken = _cardOffers.map((c) => c.cardTypeId).toSet();
                    final availCards = selectedBank.cards.where((c) => !taken.contains(c.id)).toList();
                    return Row(children: [
                      Expanded(
                        child: DropdownButtonFormField<String>(
                          value: _pickBankId,
                          decoration: const InputDecoration(labelText: 'Bank'),
                          items: allBanks.map((b) =>
                              DropdownMenuItem(value: b.id, child: Text(b.name))).toList(),
                          onChanged: (v) => setState(() {
                            _pickBankId = v;
                            _pickCardId = null;
                          }),
                        ),
                      ),
                      const SizedBox(width: 8),
                      Expanded(
                        child: DropdownButtonFormField<String>(
                          value: _pickCardId,
                          decoration: const InputDecoration(labelText: 'Card'),
                          items: availCards.map((c) =>
                              DropdownMenuItem(value: c.id, child: Text(c.name))).toList(),
                          onChanged: (selectedBank.id.isEmpty || availCards.isEmpty)
                              ? null
                              : (v) => setState(() => _pickCardId = v),
                        ),
                      ),
                      const SizedBox(width: 8),
                      FilledButton(
                        onPressed: _pickCardId == null ? null : () {
                          final card = selectedBank.cards.firstWhere((c) => c.id == _pickCardId);
                          setState(() {
                            _cardOffers.add(CardOffer(
                              cardTypeId: card.id,
                              benefitType: 'Cashback',
                              benefitValue: '',
                              bankName: selectedBank.name,
                              cardName: card.name,
                            ));
                            _pickBankId = null;
                            _pickCardId = null;
                          });
                        },
                        child: const Icon(Icons.add),
                      ),
                    ]);
                  },
                ),
                const SizedBox(height: 8),
                if (_cardOffers.isNotEmpty)
                  Column(children: _cardOffers.asMap().entries.map((e) {
                    final idx = e.key;
                    final c = e.value;
                    return Card(
                      child: Padding(
                        padding: const EdgeInsets.all(8),
                        child: Column(children: [
                          Row(children: [
                            Expanded(
                              child: Text(
                                '${c.bankName ?? ''} · ${c.cardName ?? c.cardTypeId}',
                                style: const TextStyle(fontWeight: FontWeight.w600),
                              ),
                            ),
                            IconButton(
                              icon: const Icon(Icons.delete_outline, size: 18),
                              onPressed: () => setState(() => _cardOffers.removeAt(idx)),
                            ),
                          ]),
                          Row(children: [
                            Expanded(
                              child: DropdownButtonFormField<String>(
                                value: c.benefitType ?? 'Cashback',
                                isDense: true,
                                decoration: const InputDecoration(labelText: 'Benefit'),
                                items: _benefitTypes.map((b) =>
                                    DropdownMenuItem(value: b, child: Text(b))).toList(),
                                onChanged: (v) => setState(() {
                                  _cardOffers[idx] = CardOffer(
                                    cardTypeId: c.cardTypeId,
                                    benefitType: v,
                                    benefitValue: c.benefitValue,
                                    minSpend: c.minSpend,
                                    maxBenefit: c.maxBenefit,
                                    bankName: c.bankName,
                                    cardName: c.cardName,
                                  );
                                }),
                              ),
                            ),
                            const SizedBox(width: 8),
                            Expanded(
                              child: TextFormField(
                                initialValue: c.benefitValue,
                                decoration: const InputDecoration(labelText: 'Value (10%, ₹500)'),
                                onChanged: (v) => _cardOffers[idx] = CardOffer(
                                  cardTypeId: c.cardTypeId,
                                  benefitType: c.benefitType,
                                  benefitValue: v,
                                  minSpend: c.minSpend,
                                  maxBenefit: c.maxBenefit,
                                  bankName: c.bankName,
                                  cardName: c.cardName,
                                ),
                              ),
                            ),
                          ]),
                          Row(children: [
                            Expanded(
                              child: TextFormField(
                                initialValue: c.minSpend?.toString() ?? '',
                                keyboardType: TextInputType.number,
                                decoration: const InputDecoration(labelText: 'Min spend ₹'),
                                onChanged: (v) => _cardOffers[idx] = CardOffer(
                                  cardTypeId: c.cardTypeId,
                                  benefitType: c.benefitType,
                                  benefitValue: c.benefitValue,
                                  minSpend: double.tryParse(v),
                                  maxBenefit: c.maxBenefit,
                                  bankName: c.bankName,
                                  cardName: c.cardName,
                                ),
                              ),
                            ),
                            const SizedBox(width: 8),
                            Expanded(
                              child: TextFormField(
                                initialValue: c.maxBenefit?.toString() ?? '',
                                keyboardType: TextInputType.number,
                                decoration: const InputDecoration(labelText: 'Max benefit ₹'),
                                onChanged: (v) => _cardOffers[idx] = CardOffer(
                                  cardTypeId: c.cardTypeId,
                                  benefitType: c.benefitType,
                                  benefitValue: c.benefitValue,
                                  minSpend: c.minSpend,
                                  maxBenefit: double.tryParse(v),
                                  bankName: c.bankName,
                                  cardName: c.cardName,
                                ),
                              ),
                            ),
                          ]),
                        ]),
                      ),
                    );
                  }).toList()),

                const Divider(height: 32),

                // ── Platforms ──
                Row(children: [
                  Expanded(
                    child: Text('Online platforms',
                        style: Theme.of(context).textTheme.titleSmall),
                  ),
                  TextButton.icon(
                    onPressed: () => setState(() =>
                        _platforms.add(OfferPlatform(platformName: '', url: ''))),
                    icon: const Icon(Icons.add),
                    label: const Text('Add'),
                  ),
                ]),
                ..._platforms.asMap().entries.map((e) {
                  final idx = e.key;
                  final p = e.value;
                  return Padding(
                    padding: const EdgeInsets.symmetric(vertical: 4),
                    child: Row(children: [
                      Expanded(
                        child: TextFormField(
                          initialValue: p.platformName,
                          decoration: const InputDecoration(labelText: 'Name (Amazon, ...)'),
                          onChanged: (v) =>
                              _platforms[idx] = OfferPlatform(platformName: v, url: p.url),
                        ),
                      ),
                      const SizedBox(width: 8),
                      Expanded(
                        child: TextFormField(
                          initialValue: p.url,
                          keyboardType: TextInputType.url,
                          decoration: const InputDecoration(labelText: 'URL'),
                          onChanged: (v) => _platforms[idx] =
                              OfferPlatform(platformName: p.platformName, url: v),
                        ),
                      ),
                      IconButton(
                        icon: const Icon(Icons.delete_outline, size: 18),
                        onPressed: () => setState(() => _platforms.removeAt(idx)),
                      ),
                    ]),
                  );
                }),

                if (_error != null) ...[
                  const SizedBox(height: 16),
                  Container(
                    padding: const EdgeInsets.all(10),
                    decoration: BoxDecoration(
                      color: Theme.of(context).colorScheme.errorContainer,
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: Text(_error!,
                        style: TextStyle(color: Theme.of(context).colorScheme.onErrorContainer)),
                  ),
                ],
              ],
            ),
    );
  }

  /// Opens a fullscreen image viewer at the given index, with swipe between
  /// images and pinch-to-zoom on each. Use this for both the list thumbnail
  /// (single-item list) and the images strip.
  void _openImageViewer(List<String> urls, int initialIndex) {
    Navigator.of(context).push(
      PageRouteBuilder<void>(
        opaque: false,
        barrierColor: Colors.black87,
        pageBuilder: (_, __, ___) =>
            _FullscreenImageViewer(urls: urls, initialIndex: initialIndex),
      ),
    );
  }
}

// ──────────────────────────────────────────────────────────────────────
// Tap-to-zoom hint pill (used on the thumbnail preview)
// ──────────────────────────────────────────────────────────────────────

class _TapToZoomHint extends StatelessWidget {
  const _TapToZoomHint();

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(
        color: Colors.black.withValues(alpha: 0.55),
        borderRadius: BorderRadius.circular(999),
      ),
      child: const Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(Icons.zoom_in, color: Colors.white, size: 12),
          SizedBox(width: 4),
          Text('Tap to zoom',
              style: TextStyle(color: Colors.white, fontSize: 10, fontWeight: FontWeight.w600)),
        ],
      ),
    );
  }
}

// ──────────────────────────────────────────────────────────────────────
// Fullscreen image viewer — PageView + pinch-zoom + close button
// ──────────────────────────────────────────────────────────────────────

class _FullscreenImageViewer extends StatefulWidget {
  const _FullscreenImageViewer({required this.urls, required this.initialIndex});
  final List<String> urls;
  final int initialIndex;

  @override
  State<_FullscreenImageViewer> createState() => _FullscreenImageViewerState();
}

class _FullscreenImageViewerState extends State<_FullscreenImageViewer> {
  late final PageController _controller = PageController(initialPage: widget.initialIndex);
  late int _index = widget.initialIndex;

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.black,
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        foregroundColor: Colors.white,
        elevation: 0,
        title: widget.urls.length > 1
            ? Text('${_index + 1} / ${widget.urls.length}')
            : null,
        leading: IconButton(
          icon: const Icon(Icons.close),
          onPressed: () => Navigator.of(context).pop(),
        ),
      ),
      body: PageView.builder(
        controller: _controller,
        itemCount: widget.urls.length,
        onPageChanged: (i) => setState(() => _index = i),
        itemBuilder: (_, i) => InteractiveViewer(
          // panEnabled when zoomed in, double-tap to reset.
          minScale: 1.0,
          maxScale: 5.0,
          child: Center(
            child: Image.network(
              widget.urls[i],
              fit: BoxFit.contain,
              errorBuilder: (_, __, ___) => const Center(
                child: Icon(Icons.broken_image, color: Colors.white54, size: 64),
              ),
              loadingBuilder: (_, child, progress) => progress == null
                  ? child
                  : const Center(
                      child: CircularProgressIndicator(color: Colors.white)),
            ),
          ),
        ),
      ),
    );
  }
}

// ──────────────────────────────────────────────────────────────────────
// Video preview tile — loads on-screen so seller can verify the upload
// before saving. Disposes the controller cleanly on remove / screen exit.
// ──────────────────────────────────────────────────────────────────────

class _VideoPreviewTile extends StatefulWidget {
  const _VideoPreviewTile({required this.url, required this.onRemove});
  final String url;
  final VoidCallback onRemove;

  @override
  State<_VideoPreviewTile> createState() => _VideoPreviewTileState();
}

class _VideoPreviewTileState extends State<_VideoPreviewTile> {
  VideoPlayerController? _controller;
  bool _initializing = false;
  Object? _error;

  @override
  void didUpdateWidget(covariant _VideoPreviewTile old) {
    super.didUpdateWidget(old);
    // If the seller replaces the video, swap out the controller cleanly.
    if (old.url != widget.url) {
      _controller?.dispose();
      _controller = null;
      _initializing = false;
      _error = null;
    }
  }

  @override
  void dispose() {
    _controller?.dispose();
    super.dispose();
  }

  Future<void> _initialise() async {
    if (_controller != null || _initializing) return;
    setState(() {
      _initializing = true;
      _error = null;
    });
    final c = VideoPlayerController.networkUrl(Uri.parse(widget.url));
    try {
      await c.initialize();
      await c.setLooping(false);
      if (!mounted) {
        await c.dispose();
        return;
      }
      setState(() {
        _controller = c;
        _initializing = false;
      });
    } catch (e) {
      await c.dispose();
      if (!mounted) return;
      setState(() {
        _initializing = false;
        _error = e;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final c = _controller;
    return ClipRRect(
      borderRadius: BorderRadius.circular(8),
      child: Stack(
        children: [
          AspectRatio(
            aspectRatio: c == null ? 16 / 9 : c.value.aspectRatio,
            child: c != null
                ? VideoPlayer(c)
                : Container(color: Colors.black, alignment: Alignment.center,
                    child: _initializing
                        ? const SizedBox(
                            width: 32, height: 32,
                            child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2),
                          )
                        : Column(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              const Icon(Icons.play_circle_fill, color: Colors.white, size: 56),
                              const SizedBox(height: 6),
                              Text(
                                _error == null ? 'Tap to load preview' : 'Could not load: $_error',
                                style: const TextStyle(color: Colors.white70, fontSize: 12),
                                textAlign: TextAlign.center,
                              ),
                            ],
                          ),
                  ),
          ),
          if (c == null)
            Positioned.fill(
              child: Material(
                color: Colors.transparent,
                child: InkWell(onTap: _initialise),
              ),
            )
          else
            Positioned.fill(
              child: GestureDetector(
                onTap: () => setState(() {
                  c.value.isPlaying ? c.pause() : c.play();
                }),
                child: AnimatedOpacity(
                  duration: const Duration(milliseconds: 150),
                  opacity: c.value.isPlaying ? 0 : 1,
                  child: Container(
                    color: Colors.black.withValues(alpha: 0.25),
                    alignment: Alignment.center,
                    child: Icon(
                      c.value.isPlaying ? Icons.pause_circle_filled : Icons.play_circle_fill,
                      color: Colors.white,
                      size: 56,
                    ),
                  ),
                ),
              ),
            ),
          // Scrubber pinned at the bottom — only shown after init.
          if (c != null)
            Positioned(
              left: 0, right: 0, bottom: 0,
              child: VideoProgressIndicator(
                c,
                allowScrubbing: true,
                padding: EdgeInsets.zero,
                colors: VideoProgressColors(
                  playedColor: scheme.primary,
                  bufferedColor: Colors.white24,
                  backgroundColor: Colors.white10,
                ),
              ),
            ),
          Positioned(
            top: 6, right: 6,
            child: GestureDetector(
              onTap: widget.onRemove,
              child: const CircleAvatar(
                radius: 14,
                backgroundColor: Colors.black54,
                child: Icon(Icons.close, size: 16, color: Colors.white),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
